# Exponential growth and logarithms, part 3: concepts for ten problem types

Written from the family design. Each concept names its foundations (F1 to F11 in the family design) and its picture; nothing is re-taught that an earlier film in the family owns. The three things to find (start, factor, step) and the at-a-glance habits of section 3 are assumed in every "Read".

---

## Exponential models (Algebra 1)

### `exponential-points-statement` — Doubling time and the rule from three graphed points

**Standard.** HSF.LE.A.2: "Construct linear and exponential functions... given a graph." Secondarily HSF.IF.C.8b: interpret "functions such as... y = (1.2)^{t/10}", since the whole question is where the 2 in the exponent's denominator comes from.

**Foundations first.** F2, F4. Three facts are read from the graph before any rule is written: the **start** is the point on the y-axis (b^0 = 1, so the y-intercept is the start); the **factor** is one amount divided by the one before; the **step** is the x-gap between the points, and the factor belongs to that whole gap, not to one unit. Built live: the three dots on the axes, then the step table under them (x: 0, 2, 4 with muted +2 arcs; y: 10, 20, 40 with teal ×2 arcs), then on the x-axis a ×2 arc spanning the two units from 0 to 2. "In two units it doubles once. In x units it doubles x over two times." That sentence is the exponent.

**Read.** "Which statement is true" is really "what is the factor, and how wide is one step?" At a glance: the amounts double, so the base is 2 and the linear choice is wrong; the points are two units apart, so the step is 2; the rule must give 20 at x = 2 and 40 at x = 4.

**The example.** Points (0, 10), (2, 20), (4, 40). (1) Start: the dot on the y-axis, 10. (2) Divide across each gap: 20/10 = 2, 40/20 = 2, written on the arcs; same factor: exponential, factor 2. (3) The step: the x-arcs read +2; one doubling per two units: "doubles every 2 units" goes gold in the choice. (4) Doublings in x units: x/2; so y = 10 · 2^{x/2}. (5) Test every point: x = 0: 10 · 1 = 10; x = 2: 10 · 2 = 20; x = 4: 10 · 4 = 40.

**Fast.** Factor across one gap; gap width T; exponent x/T.

**Sense.** At x = 2 the rule must have done exactly one doubling, so the exponent must be 1 when x = 2.

**Check.** Every point, not one: 10 + 5x passes (0, 10) and (2, 20) and fails only at (4, 40), where it gives 30. Decoys are built to pass two.

**Rule out.** 10 + 5x: differences 10 then 20 are not equal, so not linear (and 30 ≠ 40). 10 · 2^x: doubles every unit, so 40 at x = 2, twice too fast. 10 · 2^{x/4}: at x = 4 only one doubling, 20, too slow. All three dim in one beat: "test x equals 2 and x equals 4."

**Line.** "The factor belongs to the stretch between the points."

**Trap.** Writing 2^x because the factor is 2 and the exponent "is x"; the test at x = 2 gives 40 on screen beside the dot at 20. And the linear decoy that fits two of three points: the lesson draws the line through (0, 10) and (2, 20) and shows it missing the third dot.

**Kit.** `steps` with `stepArc` "+2"; an arc with a span on the x-axis (the `numberline` factor-arc extension, applied to `axes`). Nothing else.

**Writer.** A capable cheaper model once the pilot's timeline arcs exist: one method, one example, decoys named here.

---

### `exponential-time-steps` — When does the model reach the target?

**Off grade, say so first.** This Algebra 1 type needs logarithms, which this catalog teaches in Algebra 2 (`logarithm-value`, `exponential-equations`); Common Core puts HSF.LE.A.4 in Algebra II. Either move it or make the path reach `logarithm-value` first. Also: the slots accept natural logs only (1.5041, 0.47), though base-10 logs (0.6532, 0.2041) give the same 3.20; accept both. "3.2" to the nearest hundredth should read 3.20; 0.47 to four places should read 0.4700, as the other slots are. The 1.60 and 1.24 bases are outside the standard's "2, 10, or e"; the e variant is inside it.

**Standard.** HSF.LE.A.4: "express as a logarithm the solution to ab^{ct} = d... evaluate the logarithm using technology." HSF.BF.B.5 for the inverse relationship.

**Foundations first.** F2, F7, F8, stated as owned. The equation 80 · 1.60^t = 360 asks: how many steps of ×1.60 carry 80 to 360? Dividing by the start asks the same thing from 1: 1.60^t = 4.5, "how many steps of ×1.60 make 4.5": a logarithm. The exponent comes down because a power multiplies the step count (F8): ln(1.60^t) = t · ln 1.60. Picture: the ladder for this model: rungs 0 to 4 with 80, 128, 204.8, 327.68, 524.29; 360 placed at its true height between rungs 3 and 4. The answer is read off the picture before it is computed: a little more than 3.

**Read.** "After how many years does the model reach 360" is "solve for the exponent"; "enter each step" means the slots are the method's steps in order: the isolated power's value, the log of that value, the log of the base, their quotient. At a glance: 360 is 4.5 times 80; 1.6² is 2.56 and 1.6³ is 4.096 and 1.6⁴ is 6.55, so t is between 3 and 4.

**The example.** 80 · 1.60^t = 360. (1) Divide both sides by 80 (margin note ÷ 80): 1.60^t = 4.5; slot one. The ladder shows 4.5 as "times the start". (2) Take ln of both sides: ln(1.60^t) = ln 4.5; the exponent comes down: t · ln 1.60 = ln 4.5. (3) The two numbers from the calculator, four places: ln 4.5 ≈ 1.5041, ln 1.60 ≈ 0.4700; slots two and three. (4) Divide: t ≈ 1.5041 / 0.4700 ≈ 3.20; slot four. One beat: base-10 logs give 0.6532 / 0.2041 = 3.20 too; the count of steps does not depend on which log counts it.

**A second, brief example** because the e variant has a different shape (no division by a log): 100e^{0.1t} = 700: e^{0.1t} = 7; ln e^{0.1t} = 0.1t, because ln is the step count for e; 0.1t = ln 7 ≈ 1.9459; t ≈ 19.46. Three slots.

**Fast.** Divide by the start; take a log of both sides (either base); divide by what multiplies t; round only at the end.

**Sense.** The ladder: 80 · 1.60³ = 327.68 is below 360 and 80 · 1.60⁴ = 524.29 is above, so 3 < t < 4, and 360 is nearer 327.68, so t is nearer 3.

**Check.** 80 · 1.60^{3.20} ≈ 80 · 4.50 = 360.

**Line.** "Divide by the start, then ask how many steps."

**Trap.** Collapsing the quotient of logs into one log: ln 4.5 / ln 1.6 written as ln(4.5 / 1.6) ≈ 1.03. The ladder shows what 1.03 steps would be: about 130, nowhere near 360. The lesson writes the quotient as "how many ×1.6 steps make 4.5" and never as a single log.

**Kit.** The ladder with `place` for 360 between rungs; the board math check must know `\ln`, `\log` and `\approx` with stated rounding, or every true line here fails `--dry`.

**Writer.** A capable cheaper model once the math check knows ln: one method, the slots dictate the beats.

---

## Growth comparison (Algebra 2)

### `linear-or-exponential` — Equal differences, equal ratios, or neither

**Standard.** HSF.LE.A.1b: "Recognize situations in which one quantity changes at a constant rate per unit interval"; HSF.LE.A.1c: "...grows or decays by a constant percent rate per unit interval." The film also shows HSF.LE.A.1a in one line (the differences and the ratios on the table), which no problem asks.

**Foundations first.** F1, F3. Define both words on one step table, built live from a table of numbers: linear means the same amount is **added** each step (blue +d arcs under the amounts: equal differences); exponential means the amount is **multiplied** by the same factor each step (teal ×b arcs: equal ratios). The test is to write both arc rows and see which one is constant. Only one can be. A percent is a factor (F3): "grows 10% each week" is ×1.10, equal ratios with no arithmetic. The step row must go up by equal steps first (0, 1, 2, 3), or the arcs mean nothing.

**Read.** "Which kind of function" is "which arc row is constant?" From a story, the words decide at a glance: "the same amount each month" is an add; "percent" or "times" is a factor; "more than the month before" or "and so on" with growing amounts is a changing add, so neither.

**The example** (a table, where the picture is born; the writer uses the generated numbers; these are representative). x: 0, 1, 2, 3; y: 50, 60, 72, 86.4. (1) Steps equal: +1, +1, +1. (2) Differences row: +10, +12, +14.4: they creep up; not equal. (3) Ratios row: 60/50 = 1.2, 72/60 = 1.2, 86.4/72 = 1.2: equal. (4) Exponential: equal ratios. The staircase: each bar is the ghost of the last stretched by 1.2; the blue "add" sticks between bar tops get taller, so it was never a fixed add.

**Two quick stories**, one per remaining answer, because the type has three answers and the learner must see each decided: "120 dollars, 35 added each month": +35 arcs, linear, no table needed. "270 dollars; 15 more each month than the month before: 15, 30, 45": the arcs under the balance read +15, +30, +45, not equal; the ratios 285/270, 315/285, 360/315 are 1.06, 1.11, 1.14, not equal: neither.

**Fast.** Story: the words. Table: differences first (one subtraction each); if not constant, ratios.

**Sense.** Bars: equal differences grow by equal heights; equal ratios grow by equal stretches; growing adds grow by growing heights.

**Check.** Write the other row anyway and see that it is not constant.

**Rule out.** A story with a percent is never linear; "the same amount" is never exponential; a growing increment is neither. Dim with the word.

**Line.** "Same amount added: linear. Same factor: exponential."

**Trap.** Seeing 15, 30, 45 as "equal steps" and calling the balance linear: those are the adds, not the amounts, and the arcs under the balance show them as unequal. And "it grows fast, so it's exponential": only a constant ratio row says so.

**Kit.** `steps` with `diffs: true` (two arc rows under one amount row).

**Writer.** Strongest: mixed inputs, story reading, and the picture that every later film in the family relies on is born here.

---

### `exponential-overtakes` — Where the exponential passes the line

**Standard.** HSF.LE.A.3: "Observe using graphs and tables that a quantity increasing exponentially eventually exceeds a quantity increasing linearly." Pilot lesson 5.

**Foundations first.** F5. The line adds the same amount every step: 29. The exponential adds its own current value every step (×2 means "add what you have"): 1, 2, 4, 8, 16, 32, ... So its add grows while the line's never does. Once the exponential's add passes 29 (at the step from x = 5 to 6, add 32), the gap closes by more every step, and once it is on top it stays on top forever, because from then on it gains more every step than the line does. Picture: the vertical step table (x | f | g) with blue +29 arcs beside f and teal ×2 arcs beside g; beside it the graph: blue line, teal dots, a stick between them at every whole x.

**Read.** "The least whole number x for which g(x) > f(x)": the first row where the exponential is on top, strictly. Which letter is the exponential is read from the rules, not assumed. At a glance: the line starts ahead (15 against 1) and will be ahead for a while; the answer is where the sticks flip.

**The example.** f(x) = 29x + 15, g(x) = 2^x. (1) Fill the table one row at a time, both columns: 15, 44, 73, 102, 131, 160, 189, 218, 247 and 1, 2, 4, 8, 16, 32, 64, 128, 256. (2) Sticks: the gap grows (14, 42, 69, 94, 115, 128), then shrinks (125, 90), then flips (−9 at x = 8). The lesson says why it turned at x = 6: g's add became 32, more than 29. (3) x = 8 goes gold; the bars pull back as 256 outgrows the frame and the line flattens. (4) Answer 8.

**A brief second case** because the story input reads differently: Offer A, 30 coins plus 13 a day; Offer B, 1 coin doubling. Continue both lists: 108 against 64 on day 6; 121 against 128 on day 7. Day 7.

**Fast.** Continue both lists until the exponential is on top; that x is the answer. There is no shortcut at this grade; the sure sign that the turn has come is the exponential's add passing the line's add.

**Sense.** The gap must shrink for a few rows before it flips; if it is still growing, keep going. After the flip the exponential never comes back.

**Check.** The row before: 128 < 218. The row: 256 > 247.

**Line.** "Adding gets tired; multiplying never does."

**Trap.** Stopping at the first row where the gap narrows (x = 6) or where the exponential's add beats the line's; answering the value (256) instead of x; and on the graph, reading the crossing "between 7 and 8" as 7. The row-before check and the sticks settle each.

**Kit.** `steps` vertical with two amount columns and two arc inks; gap sticks colored by which is on top; `fit` pull-back; `points` hand-off to axes.

**Writer.** Strongest (pilot): the staged motion is the standard's "observe."

---

### `exponential-decay-table` — Which list decays exponentially?

**Standard.** HSF.LE.A.1c: "Recognize situations in which a quantity grows or decays by a constant percent rate per unit interval."

**Foundations first.** F1, F3. Decay is the same trick with a factor between 0 and 1: each value is a fixed share of the one before. The cut bar: keep three quarters, lose one quarter in rust; the kept part is the next bar, so the next loss is a quarter of a smaller bar. That is why the drops of a decaying list shrink. Linear decline loses the same amount every step: the drops are equal. Growth has a factor above 1: the list rises. Three pictures, one step table each with its ratio row.

**Read.** "Shows exponential decay": the list falls, and dividing each value by the one before gives the same number less than 1. At a glance: a rising list is out; a list with equal drops is linear and out.

**The example.** 320, 280, 200, 80 | 320, 240, 180, 135 | 320, 256, 192, 128 | 135, 180, 240, 320. (1) Direction: the last list rises (×4/3, exponential growth): dim. (2) Differences on the three that fall: −64, −64, −64 on the third: linear, dim. −40, −80, −120 on the first: the drops grow, not equal; its ratios 0.875, 0.714, 0.4 are not equal either: neither, dim. (3) The second: 240/320 = 0.75, 180/240 = 0.75, 135/180 = 0.75; the cut bar at 75% three times. Exponential decay: it keeps 75%, loses 25%, each step.

**Fast.** Direction first; then divide neighbors in the falling lists; constant and below 1 is the answer.

**Sense.** A decaying list's drops shrink (80, 60, 45 here). Shrinking drops are a sign, not a proof; equal ratios are the proof.

**Check.** 320 × 0.75 three times: 240, 180, 135.

**Rule out.** Rising: not decay. Equal drops: linear. Growing drops: neither. Three dims, one beat each with its reason.

**Line.** "Decay: same factor, less than one. The drops shrink; the ratio stays."

**Trap.** Picking 320, 280, 200, 80 because it falls hardest ("it decays fast"): its lost pieces grow, and decay's lost pieces shrink. Picking 320, 256, 192, 128 as "steady decline": steady is the add, which is linear.

**Kit.** `steps` with `diffs` and `cut`.

**Writer.** A capable cheaper model from this concept.

---

### `exponential-passes-linear` — First whole x where f(x) > g(x), from the rules

**A duplicate, say so first.** This is `exponential-overtakes` with the two functions given symbolically. Keep as its own short film only because the input (two rules, letters that must be read) is a different act of reading.

**Standard.** HSF.LE.A.3 as above; HSF.IF.A.2: "evaluate functions for inputs in their domains."

**Foundations first.** F5 in one short "why" shot (the exponential's add grows; the line's does not), then the habit: fill both columns at x = 0, 1, 2, ... and compare row by row. Say which rule is exponential by its shape (x in the exponent), whatever letter it wears; in one variant g is given first.

**Read.** "Least whole number x for which f(x) > g(x)": strictly greater, so a tie is not an answer. At a glance: evaluate both at 0 first; if the exponential starts behind, the answer is some rows down.

**The example.** f(x) = 4(1.8)^x, g(x) = 12x + 4. (1) x = 0: 4 and 4, a tie: not greater. (2) Rows, two decimals: x = 1: 7.2 against 16; 2: 12.96 against 28; 3: 23.33 against 40; 4: 41.99 against 52; 5: 75.58 against 64. (3) Gap sticks shrink from x = 3 and flip at 5. Answer 5.

**A brief second case** because "eventually" can be slow and the learner must not quit: f(x) = 3(1.5)^x, g(x) = 12x + 10. The table runs to x = 9: 115.33 against 118, still behind; x = 10: 172.99 against 130. Answer 10. Same method, longer table.

**Fast.** Table until the flip; the row before confirms it.

**Sense.** A smaller factor takes longer; the exponential's add must pass the line's add before the gap can close.

**Check.** The row before: 41.99 ≤ 52. The row: 75.58 > 64.

**Line.** "Fill the table until it flips, then check the row before."

**Trap.** Reading the letters backward and answering the first x where the *line* is greater (x = 1 here). The lesson points at the exponent to name the exponential before any row is filled. And the tie at x = 0: equal is not greater.

**Kit.** `steps` vertical with two columns; nothing new.

**Writer.** A capable cheaper model after `exponential-overtakes` has been approved.

---

## Logarithms (Algebra 2)

### `logarithm-value` — The exact value of a logarithm

**Standard.** HSF.BF.B.5: "Understand the inverse relationship between exponents and logarithms and use this relationship to solve problems involving logarithms and exponents." Pilot lesson 4.

**Foundations first.** F7. Define: log_b N is the number of steps of ×b from 1 to N. Build the ladder for base 3 live: rung 0 is 1; ×3 to rung 1, 3; rung 2, 9; rung 3, 27; rung 4, 81. Reading back with the gold arrow from 81 to its rung: log_3 81 = 4. "The base of the log is the base of the power." Then three extensions, each one move on the same ladder: "log" with no base is base 10, the place-value shift: 1, 10, 100, 1000, so log 1000 = 3, three shifts. Steps **down** divide: 1/3 at rung −1, 1/9 at −2, 1/27 at −3, 1/81 at −4. A **fraction of a step**: √5 is half a step up from 1 because two half-steps make one (√5 · √5 = 5), so it sits at rung 1/2; ∛5 at rung 1/3. Last, the graph: y = log_3 x is the ladder with its rungs as points, (1, 0), (3, 1), (9, 2), (27, 3); the dashed line x = 9 meets the curve at the rung 2.

**Read.** Every variant asks: which rung is N on? At a glance: N below 1 means a negative rung; N between 1 and b means a fraction; N above b means more than 1; a graph reading is the rung at the given x.

**The example.** log_3 (1/81). (1) Where is 1/81 on the base-3 ladder? Below 1, so the steps go down. (2) 81 = 3^4, so 1/81 = 3^{−4}: four steps down. (3) The arrow reads back from 1/81 to rung −4. (4) −4. **Quick second case** (a fraction of a step is a different act): log_5 √5: √5 = 5^{1/2}; half a step; 1/2; check (5^{1/2})² = 5. **Quick third**: log 1000: three shifts: 3; the graph reading at x = 9 on y = log_3 x: 2.

**Fast.** Write N as a power of b; the exponent is the answer. A reciprocal gives a negative exponent, a root a fraction.

**Sense.** N < 1: negative. 1 < N < b: between 0 and 1. N > b: more than 1.

**Check.** Raise the base to the answer: 3^{−4} = 1/81.

**Line.** "A log asks: how many steps?"

**Trap.** Dropping the sign (log_3 (1/81) = 4), or answering the root's index (log_5 √5 = 2), or dividing (log 1000 = 100). The ladder's rungs below 1 and the half rung make the first two impossible; the shift picture the third.

**Kit.** The ladder layout with `read`, rungs below zero, fractional rungs; `plot` grammar `log(x, b)` for the graph variant.

**Writer.** Strongest (pilot): the word is defined and the picture born here; every log film stands on it.

---

### `log-exponential-form` — Two forms of one fact; a log between whole numbers

**Standard.** HSF.BF.B.5, as above: the "inverse relationship between exponents and logarithms." Two cases under one name, both read off the ladder.

**Foundations first.** F7. One rung of the ladder holds three numbers: the base (the size of every step), the step count, and the amount. Read down it says b^p = N: p steps of ×b make N. Read back it says log_b N = p: N is p steps up. Same rung, two sentences. The base is the base in both; the step count is the exponent in one and the log's value in the other; the amount is N. A number that is not on a rung sits between two; its log is between those two step counts, and the way to find them is to list the powers of b until one passes N.

**Read.** "Means the same as": keep the base, swap which of the other two is asked. "Between which two consecutive whole numbers": which two rungs is N between?

**Example A** (conversion). "Which equation means the same as log_3 81 = 4?" (1) Base 3; 81 is at rung 4. (2) Read down: four steps of ×3 make 81: 3^4 = 81. (3) The other direction in one beat: 3^2 = 9 read back is log_3 9 = 2.

**Example B** (bounding; a different act, so worked in full). "Between which two consecutive whole numbers is log 831?" (1) Base 10 ladder: 1, 10, 100, 1000 at rungs 0, 1, 2, 3. (2) 831 is past 100 and short of 1000: between rungs 2 and 3; the dot sits at its true height, high in the gap, but the question asks only the two whole numbers. (3) 2 and 3. Quick: log_2 7: 1, 2, 4, 8; 7 is between 4 and 8: between 2 and 3.

**Fast.** Conversion: base stays; "log_b N = p" is "b^p = N". Bounding: list powers of b until one passes N; for base 10, a three-digit number has a log between 2 and 3 (digit count minus one, and the digit count).

**Sense.** 831 is a three-digit number, so two shifts have happened and not three.

**Check.** Compute the chosen power form (3^4 = 81, true) and read it aloud. For the bound: 10² = 100 < 831 < 1000 = 10³.

**Rule out.** 3^81 = 4 and 81^4 = 3: 81 raised to anything is bigger than 81, and 3 multiplied 81 times is enormous; 4^3 = 81: the base changed, and 4^3 is 64 anyway. For the bound: 831 < 1000 kills "3 and 4"; 831 > 100 kills "1 and 2". Each set dims in one beat.

**Line.** "The base of the log is the base of the power."

**Trap.** Swapping the step count and the amount (log_3 2 = 9 for 3^2 = 9): the ladder shows 9 as an amount on a rung and 2 as a rung number; a rung number never becomes an amount. And reading log 831 by its leading digit ("between 8 and 9"): the ladder's rungs are powers of ten, not digits.

**Kit.** The ladder with `place` at true height; nothing new beyond `logarithm-value`.

**Writer.** A capable cheaper model from this concept.

---

### `logarithm-integer` — log base 4 of 16

**A subcase, say so first.** This is the whole-number case of `logarithm-value` with the problem in words. One variant. The film should be short, about a minute.

**Standard.** HSF.BF.B.5.

**Foundations first.** F7, in the ladder's own words: start at 1, multiply by 4, count the steps. Rungs: 1, 4, 16, 64.

**Read.** "log base 4 of 16": how many ×4 steps from 1 reach 16?

**The example.** (1) Rung 0: 1. (2) ×4: 4, one step. (3) ×4: 16, two steps; the gold arrow reads back from 16 to rung 2. (4) 2.

**Fast.** Multiply the base by itself, counting, until N appears.

**Sense.** 16 is more than 4, so more than one step; less than 64, so fewer than three.

**Check.** 4 × 4 = 16.

**Line.** "A log asks: how many steps?"

**Trap.** Answering 4 (16 ÷ 4 = 4, one division, then stopping) or 12 (16 − 4). The ladder counts both steps and never subtracts.

**Kit.** None beyond the ladder.

**Writer.** A capable cheaper model.

---

### `function-graph-features` — Intercept, asymptote, domain, end behavior

**Standard.** HSF.IF.C.7e: "Graph exponential and logarithmic functions, showing intercepts and end behavior"; HSF.IF.B.4: "Key features include: intercepts... end behavior"; HSF.IF.B.5: "Relate the domain of a function to its graph." A mixed type: six variants read a feature from a graph or from an equation, of an exponential or a logarithm. The lesson teaches reading, not a recipe.

**Foundations first.** F6, F10. Two curves, each with one wall it never touches. The exponential a · b^x + k: multiplying positives never gives zero, so b^x is never 0, so a · b^x + k is never k: the curve hugs the **horizontal** line y = k and never touches it (the never-zero zoom: the gap halves and halves). The number added at the end is the wall. The y-intercept is a + k, since b^0 = 1. Increasing or decreasing is read as the curve's direction left to right. Then the swap: flip the whole picture over y = x and the exponential becomes the logarithm; the horizontal wall stands up **vertical**, because there is no step count for zero or a negative: a · log_b (x − h) + k lives only where the inside x − h is positive, so the domain is x > h and the wall is x = h. Where the inside is 1 the log is 0: with k = 0 the x-intercept is (h + 1, 0). A log has no horizontal wall; it keeps climbing, slowly.

**Read.** First: exponential or logarithm (x in an exponent, or inside a log; on a graph, which way the wall runs). Then the feature asked, gold: domain, intercept, asymptote, direction. At a glance: a horizontal asymptote is "y =" and a vertical one is "x ="; a domain is about x; an intercept on the y-axis has x = 0.

**Example A** (from an equation, the log). f(x) = log_2 (x − 4) + 2: domain and vertical asymptote. (1) The inside, x − 4, must be positive. (2) x − 4 > 0, so x > 4: the domain. (3) The wall is where the inside is zero: x = 4. (4) The +2 lifts the curve; it makes no wall. Choice: domain x > 4, vertical asymptote x = 4. Check: x = 5 gives log_2 1 + 2 = 2, fine; x = 4 gives log_2 0, which does not exist.

**Example B** (from a graph, the exponential; a different act). The graph of an exponential falling left to right and flattening toward a dashed line at y = 3. (1) Direction: decreasing. (2) The wall is horizontal, so it is "y =", and the curve flattens at 3: horizontal asymptote y = 3. The statement "decreasing with horizontal asymptote y = 3."

**Quick reads**, one each, because they are single lookups once the walls are understood: the exponential's y-intercept is where the curve meets the y-axis, (0, 1); the log's x-intercept is where it meets the x-axis, (4, 0); the log's domain from its graph is everything right of its wall at x = 1: x > 1.

**Fast.** Exponential: wall y = k, intercept a + k. Logarithm: inside > 0 gives the domain; the inside's zero is the wall. Graph: find the wall; the curve lives on one side of it.

**Sense.** A log's wall is vertical; an exponential's is horizontal. A domain is a set of x values.

**Check.** Equation: plug a value inside the claimed domain (it exists) and the wall's value (it does not). Graph: trace the curve toward the wall and see it never cross.

**Rule out.** "horizontal asymptote y = 2" for a log: wrong wall; "x > −4": the sign flipped, and x = 0 gives log_2 (−4), which does not exist; "x > 0": ignores the shift. For the exponential statement: "asymptote x = 0" is a vertical wall, wrong curve; "increasing" is the wrong direction. Each set dims in one beat.

**Line.** "Multiplying positives never gives zero" and "no step count for zero or a negative": one wall each.

**Trap.** Taking the +k of a logarithm as a horizontal asymptote, and reading x − 4 > 0 as x > −4. The swap motion (the wall stands up) and the plug-in of x = 0 make both impossible.

**Kit.** `plot` grammar `log(x, b)`; `seg` dashed and extended for the walls; `flip` of a plot over y = x (confirm it reflects a curve, not only dots); the graph variants use the app's own figure (`example: true`).

**Writer.** Strongest: mixed reading across two curves and two input shapes, and the swap is a motion that must be staged.