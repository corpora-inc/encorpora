# Linear relationships, part 3: concepts for ten problem types

Written from the family design. Each concept names the foundations it stands on by number (section 1 of the design) and the picture by name (section 2). Three things first:

- **Misfiled.** `interpret-linear-parameters` and `line-equation-forms` sit in Algebra 1 modeling but practice 8.F.B.4 and HSF.LE.A.2/B.5 at grade-8 depth; fine where they are, but their lessons speak grade 8. `line-relationship-equations` serves HSG.GPE.B.5 alone and belongs in `slope-proofs`. `rate-combination-model` and `sat-entry-rate-numeric` have no line, slope or intercept in them; they are rate reasoning (HSA.CED.A.1, HSN.Q.A.1) and belong with family 10. Their concepts are written here anyway, since the lessons are needed, and they share one foundation built in both.
- **Off type.** `linear-model-value`'s rectangle variant (length 1 more than three times the width, perimeter 74) is 7.EE.B.4a with no rate or start; it should move to family 11 or 24. The concept gives it one quick screen in case it stays.
- **Shared opening.** Every lesson here whose picture is the line opens with the same twenty seconds, drawn live: the line, the gold dot where it meets the y-axis ("the start, b, the value at zero"), one unit triangle from it (blue run of 1, rust rise of m: "per one"), and the words "the number with the letter is per; the number alone is the start." Then the foundation the type adds.

---

## `graph-of-linear-rule` — Choose the graph from a rule or a table

**Standard.** 8.F.A.3: "Interpret the equation y = mx + b as defining a linear function, whose graph is a straight line." 8.F.B.4: "Determine the rate of change and initial value ... including reading these from a table." The app's method also mentions solving ax + y = c for y, but no generated wording does it; if it appears, one beat.

**Foundations first.** Foundations 2, 3, 4. Define y-intercept: where the line meets the y-axis, the point (0, b). Define slope as the unit triangle: from any point, 1 right, m up (down when m is negative). Then the whole-number triangle for a fraction: for p/q, q right and p up, because q unit steps of p/q each add p; drawn on the grid so the learner sees the two triangles reach the same line. Said once: "A graph is right only if it crosses the axis at b *and* steps by m."

**Read.** "Slope" and "y-intercept" gold. The answer must cross the y-axis at (0, 4) and, since the slope is negative, fall left to right. At a glance: any rising graph is gone; any graph that does not pass through (0, 4) is gone.

**The example.** "Which graph shows the line with slope −2/3 and y-intercept 4?" The four graphs are drawn as four small axes in one card, A to D, each line to scale. (1) b = 4: the gold dot at (0, 4) is placed on the big grid; graph C (through (−2, 4) and (1, 2)) meets the height 4 at x = −2, not on the axis, so it dims; graph B rises, so it dims; both in one beat with the reason said. (2) From (0, 4), the slope triangle: blue run 3 right along the grid, rust rise 2 *down*, right-angle mark, landing on (3, 2). The fraction beside it, rust over blue: −2/3. (3) Graph A passes through (0, 4) and (3, 2): the triangle fits it. Graph D passes through (0, 4) and (2, 1): run 2, rise −3: that is −3/2, the legs swapped. (4) A.

**Quick second case** (the table wording): the table's x = 0 row has a gold band: b = −4, read with no work; rust arcs +1, +1 between outputs over blue arcs +1: m = 1. From (0, −4) one right, one up: (1, −3). Three beats; it is the same test with the two numbers read from a table instead of a rule.

**Fast.** b first, dim everything not through (0, b); then q right, p up or down, and keep the graph the triangle lands on.
**Sense.** Negative slope, falling line; the second point is lower than the start.
**Check.** Put x = 3 into y = −2/3 x + 4: 4 − 2 = 2. The graph's second point is (3, 2).
**Rule out.** Wrong direction and wrong axis crossing dim together first; then build the triangle on the survivors.
**Line.** "Start at b. Run right, then read the rise."
**Trap.** Run and rise swapped (graph D). The triangle is always drawn run first, along the grid, in blue; the rise is read second, in rust, and the fraction is written in those colors, bottom and top.
**Kit.** A choice card that holds four small graphs (axes, line, two marked points) that `dim` together; this is new, since choice pills hold text today. `slopetri` with `frac`.
**Writer.** A capable cheaper model: one method, one component, decoys named.

---

## `line-from-point-steps` — Write y = mx + b from a slope and a point

**Standard.** 8.F.B.4: "Determine the rate of change and initial value of the function ... from two (x, y) values." The answer is a list of steps with boxes (slope when two points are given, then m·x, then b, then the equation), some already filled.

**Foundations first.** Foundations 4 and 5. "A point on the line makes the equation true": put the point's x and y into y = mx + b and both sides agree, so the only unknown left is b. Then the picture of what that algebra is: the **walk back**. From the given point, slope triangles step left until x = 0; the height there is b. One line of algebra and one picture, said as the same thing: "b is the point's y, minus the slope times the point's x."

**Read.** "Slope-intercept form" gold; the steps show what is wanted in what order. At a glance: m is given, so the equation already reads y = 7/5 x + ?; only b is missing. The line climbs and the point (5, −6) is below the axis, so walking left to x = 0 goes down: b is below −6.

**The example.** "A line has slope 7/5 and passes through (5, −6)." Chosen because the point's x equals the slope's denominator, so one triangle lands exactly on the axis. Picture: axes with the dot (5, −6) labeled, the line through it with slope 7/5. (1) Write y = mx + b; put in m, x, y: −6 = 7/5 · 5 + b. (2) Step box one: 7/5 · 5 = 7. On the graph, the slope triangle read backward from the point: blue run 5 left to the axis, rust rise 7 down; the right-angle mark at the corner. (3) −6 = 7 + b, so b = −6 − 7 = −13 (box two). The gold dot lands at (0, −13); the line is drawn through both. (4) Box three: y = 7/5 x − 13.

**Second worked case** (two points; a different act, the slope must be found and signs subtracted): (6, 8) and (12, 4). Subtract in the same order: 4 − 8 = −4 over 12 − 6 = 6, so m = −2/3; the sign agrees with the picture (y falls as x rises). Then m·x with the first point: −2/3 · 6 = −4; b = 8 − (−4) = 12. Equation y = −2/3 x + 12. Check with the other point: −2/3 · 12 + 12 = −8 + 12 = 4. Five beats.

**Fast.** b = y − m·x, in words: "the point's y, minus slope times the point's x."
**Sense.** From the picture, walking left along a climbing line goes down, so b < −6; −13 fits.
**Check.** Put x = 5 in: 7 − 13 = −6, the point's y. With two points, the second point.
**Line.** "To find b, walk back to x equals zero."
**Trap.** b taken as the point's y (the equation y = 7/5 x − 6), or the subtraction turned around (7 − (−6) = 13). The walk back shows b sitting at the axis, seven below the point, and the step boxes force m·x to be written before b.
**Kit.** Boxes in the steps card that fill on the word (family tool 4.7); `slopetri.step` leftward.
**Writer.** A capable cheaper model.

---

## `wage-and-cost-blanks` — Wage and uniform cost from a net-pay table

**Standard.** 8.F.B.4: "Determine the rate of change and initial value ... from a table"; "interpret the rate of change and initial value ... in terms of the situation." The facts sample shows one wording with no numbers and answers by letter (wage "c", cost "d"), so the sentence has lettered choices in its blanks; the lesson uses the app's own sentence and choices. The example below supplies numbers in the app's range.

**Foundations first.** Net pay = pay earned − cost paid first; built as a bar: pay earned for 2 hours is two equal rust blocks (the wage each), the uniform is a block taken off the front, net pay is what is left. On the graph the line therefore starts *below zero*: at 0 hours the worker has earned nothing and is out the cost of the uniform, so the y-intercept is −cost and the wage is the slope. Also foundation 1: when the table's hours skip, divide the change in net pay by the change in hours.

**Read.** "Wage" is how much net pay rises each hour: the rate. "Cost" is the amount taken off before the first hour: the opposite of the start. At a glance: the hours step by 2, so each change in the table is two hours' worth.

**The example.** Table: hours 2, 4, 6; net pay 10, 38, 66. (1) Blue arcs between hours: +2, +2. Rust arcs between net pay: +28, +28. Same change for each step: steady. (2) 28 dollars for 2 hours is 28 ÷ 2 = 14 per hour: the wage, written in rust. (3) By hour 2 the worker earned 2 × 14 = 28 but has 10, so 28 − 10 = 18 went to the uniform. On the graph, two unit triangles step left from (2, 10): (1, −4), then (0, −18); the gold start is −18. (4) Sentence filled: wage 14, cost 18.

**Fast.** Wage = change in net pay ÷ change in hours. Cost = wage × hours − net pay, from any column.
**Sense.** The line starts below zero and crosses it a little after one hour; every net pay is less than wage × hours.
**Check.** Another column: 4 × 14 − 18 = 38.
**Rule out.** A wage choice equal to the raw table difference (28) dims because the hours step by two; a cost choice equal to a net-pay entry dims because net pay is what is *left*, not what was taken.
**Line.** "Per hour: divide by the hours. The start is below zero by the cost."
**Trap.** 28 taken as the wage because the inputs skip; the cost read as the first net pay. The blue +2 arcs are drawn before any division, and the bar shows the uniform coming off the front.
**Kit.** `table` deltas; a sentence card with lettered blanks that fill; axes with negative y.
**Writer.** A capable cheaper model.

---

## `interpret-linear-parameters` — What the two numbers mean, with units

**Standard.** HSF.LE.B.5: "Interpret the parameters in a linear ... function in terms of a context." 8.F.B.4: "Interpret the rate of change and initial value of a linear function in terms of the situation it models." Both practiced exactly; the type is grade-8 depth and speaks that way.

**Foundations first.** Foundations 3 and 4, with units. Build V = 124 − 11t on a table: t = 0, 1, 2, 3 and V = 124, 113, 102, 91, gold band on the t = 0 row, rust arcs −11. Say it twice, in words and on the picture: the number *with the letter* is how much the output changes for each one of the input, in output units per input unit (liters per minute), and its sign is the direction; the number *alone* is the output when the input is zero, in output units (liters), and "zero minutes" is the moment the story starts, before anything has happened.

**Read.** "Interprets both numbers" (or "the number 15") gold. At a glance: the letter is t, so 6 is per minute; the sign in front is minus, so it decreases; 189 stands alone, so it is at zero.

**The example.** "V = 189 − 6t ... Which statement interprets both numbers?" (1) Underline the term with t in rust: −6t: six liters for each minute, going down. (2) Put t = 0: V = 189, gold: when the drain opens. Table t 0, 1, 2: 189, 183, 177, arcs −6. (3) Dim three together with their reasons: "increases" contradicts the minus; "189 liters after one minute": at t = 1 the table says 183; "decreases by 189 per minute, 6 at zero": the numbers are swapped, the letter sits beside 6. (4) The statement: decreases by 6 liters per minute; 189 liters when the drain opens (0 minutes).

**Quick second case** (the one-number wording, positive): H = 2w + 15, "what does 15 represent?" No letter beside it: the height at planting, 15 cm. The decoy "15 after one week" dims because at w = 1 the height is 17. Three beats.

**Fast.** Find the letter: its number is per, its sign the direction. The number alone is the start. Say the units.
**Sense.** The start should be the biggest value in a draining story and a reasonable size (a tank of 189 liters, a seedling of 15 cm).
**Check.** Put in 0 and 1: 189, then 183: down 6 from the starting 189.
**Rule out.** Wrong direction (against the sign), "after one" (against t = 0), swapped numbers (against which number the letter touches): all in one beat.
**Line.** "The number with the letter is per. The number alone is the start."
**Trap.** "After one week" for "at zero": children count the first step as the start. The gold t = 0 row and the t = 1 row stand side by side in the table, 189 against 183.
**Kit.** `table` with deltas and the zero row; `line` with `from: 0`. Nothing new.
**Writer.** A capable cheaper model.

---

## `line-equation-forms` — Point-slope, slope-intercept, standard

**Standard.** HSF.LE.A.2: "Construct linear ... functions ... given ... two input-output pairs." HSA.CED.A.2: "Create equations in two ... variables to represent relationships." 8.F.B.4 for the slope and intercept. Six wordings: each of three forms, from a point and slope or from two points, or from another form.

**Foundations first.** Foundations 2, 4, 5. Three ways to write one line, drawn on one graph. Slope-intercept: start at b, m per one. **Point-slope is the slope definition with a general point:** take the given point (x₁, y₁) and any other point (x, y) on the line; rise over run is (y − y₁)/(x − x₁) = m; multiply by the run: y − y₁ = m(x − x₁). So the point's coordinates appear *subtracted*, which is why (−2, 3) becomes (x + 2) and (y − 3). Standard: Ax + By = C, the same line before anyone solved for y, with whole-number A, B, C and no common factor. And the one test for all three: the given point makes both sides equal.

**Read.** Which form is asked (gold) and what is given. At a glance: a given point with x = 0 hands over b ((0, −2) in the slope-intercept wording, so b = −2 with no work, and the slope 3 finishes it); a given slope dims every choice with another slope at once.

**The example.** "A line passes through (−2, 4) and (2, −1). Which equation is a standard form?" Chosen because it travels through all three forms. (1) Slope, subtracting in the same order: −1 − 4 = −5 over 2 − (−2) = 4: m = −5/4; the triangle on the graph, run 4 blue, rise 5 down rust, agrees. (2) Point-slope with (−2, 4): y − 4 = −5/4 (x + 2). (3) Multiply out and solve for y: y = −5/4 x + 3/2. (4) Clear the fraction, ×4: 4y = −5x + 6; move the x term over: 5x + 4y = 6. (5) Check *both* points: 5(−2) + 4(4) = 6; 5(2) + 4(−1) = 6.

**Second worked case** (point-slope from a point and slope, the sign flip): (−2, 3), slope 3: y − 3 = 3(x + 2). The decoys are the three ways to mishandle the signs: y + 2 = 3(x − 3) swaps the coordinates; y − 3 = 3(x − 2) forgets that x₁ is negative; y + 3 = 3(x + 2) flips the wrong one. Check: put (−2, 3) in: both sides are 0. Four beats.

**Fast.** m first; then the point into the asked form; for standard, clear the fraction and move the x term.
**Sense.** m negative because the line falls; in standard form, A and B have the same sign when the slope is negative.
**Check.** Both given points make both sides equal.
**Rule out.** Plug a given point into every choice; what fails dims. Then plug the *other* point: 5x − 4y = −26 and 4x + 5y = 12 each pass one of the given points and fail the other.
**Line.** "A point on the line makes the equation true, in every form."
**Trap.** A wrong-sign or swapped-coefficient line that still passes one of the given points. The lesson checks both, and says why: two points fix a line, one does not.
**Kit.** `slopetri` with `frac`; `dim`; the board's `write` with margin notes (×4, +5x).
**Writer.** Strongest: six givens-to-forms combinations, and the example must be the one that passes through every form and exposes the one-point decoy.

---

## `line-relationship-equations` — Parallel, perpendicular, flat and upright

**Standard.** HSG.GPE.B.5: "use them to solve geometric problems (e.g., find the equation of a line parallel or perpendicular to a given line that passes through a given point)." Misfiled under Algebra 1 modeling; belongs in `slope-proofs`. This concept specifies what the lesson must teach and how `slopetri.turn` should carry labels.

**Foundations first.** Foundations 5 and 8. The slope of Ax + By = C is read only after solving for y (5x + 2y = −4 → y = −5/2 x − 2), because the number in front of x is the slope *only when y is alone*. Parallel: same slope, the shift motion (the line slides, m unchanged). Perpendicular: the quarter turn: the triangle run 2, rise −5 lifts and turns 90° about its corner; the blue run now stands as a rise of 2 and the rust rise lies as a run of 5; the new slope is 2/5, flipped *and* its sign changed. Flat lines are y = k (every point has that y, slope 0); upright lines are x = k (every point has that x, no slope).

**Read.** "Perpendicular," "parallel," "vertical" gold; the given point. At a glance: a perpendicular to a falling line climbs, so every falling choice dims; a parallel keeps the slope, so every other slope dims.

**The example.** "The line through (5, 5) perpendicular to 5x + 2y = −4." (1) Solve for y: 2y = −5x − 4, y = −5/2 x − 2; slope −5/2. (2) Quarter turn on the graph: 2/5. (3) Walk back from (5, 5): 5 = 2/5 · 5 + b = 2 + b, so b = 3; the gold dot at (0, 3), the triangle run 5 back, rise 2 down. (4) y = 2/5 x + 3. The decoys are all three mistakes: −5/2 x + 35/2 kept the slope (parallel); −2/5 x + 7 flipped without changing sign; 2/5 x + 5 took b as the point's y.

**Quick second case** (upright): parallel to x = −5 through (2, 4). x = −5 is upright; a parallel is upright too, and every point on it has the x of the given point: x = 2. The decoy y = 4 kept the wrong coordinate. Three beats, with the two upright lines drawn.

**Fast.** Solve for y; copy the slope (parallel) or turn the triangle (perpendicular); b = y − m·x.
**Sense.** Perpendicular to a falling line climbs; the new line visibly meets the old one at a right angle on the grid.
**Check.** Slopes multiply to −1 (−5/2 · 2/5); the point makes both sides equal (2 + 3 = 5).
**Rule out.** Wrong direction first; then the slope that only flipped or only negated; then the point.
**Line.** "Parallel: same slope. Perpendicular: turn the triangle."
**Trap.** 5 read as the slope of 5x + 2y = −4; the reciprocal taken without the sign change; b as the point's y. The solve-for-y step is written, the turn is seen, and the walk back lands on the axis.
**Kit.** Labels that ride turned parts (the open KAIZEN wish); otherwise nothing new.
**Writer.** A capable writer can implement this concept once the turn carries its labels. Consider a separate short lesson for flat and upright lines.

---

## `rate-combination-model` — Rates acting together

**Standard.** HSA.CED.A.1: "Create equations ... in one variable and use them to solve problems"; HSN.Q.A.1: "Use units as a way to understand problems." Misfiled in this family: no line, slope or intercept; it is family 10's unit rate. The HSA.REI.A.2 link is thin (1/15 + 1/9 = 1/t is a rational equation; extraneous solutions never arise). A **mixed** type: five kinds under one name, so the lesson teaches reading, one example per kind, each on its own screen.

**Foundations first.** Foundation 9, built on the job bar. A pump that fills a reservoir in 15 hours does 1/15 of it *each hour*: the rate is how much per hour, never how long. Draw the bar of one whole job cut into 45 equal parts; pump one fills 3 parts each hour (teal), pump two 5 parts (violet). Said once: "Rates add. Times do not." Then the four readings the words carry: working together, rates add; working against, subtract; a mixture's strength is pure stuff over all the liquid; average speed is all the distance over all the time.

**Read.** For each story: what is per hour, what is being asked (a time, a percent, a speed), and what the answer must be smaller or larger than. The asked word gold.

**The example (shared work, full).** "First pump 15 hours, second 9 hours; together?" Choices 8/45, 12, 24, 45/8. (1) At a glance: together is faster than the faster one alone, so the time is under 9: 12 and 24 dim (24 is the times added, 12 their average); 8/45 of an hour is about eleven minutes, dims too. (2) Rates: 1/15 and 1/9 per hour; common pieces: 3/45 + 5/45 = 8/45 of the job per hour. On the bar, each hour lands 3 teal and 5 violet parts side by side: 8 of 45 each hour. (3) Hours to fill 45 parts at 8 per hour: 45 ÷ 8 = 45/8, five and five eighths; the bar fills in five full hours (40 parts) plus five eighths of an hour. (4) 45/8 hours. Check: 45/8 × 8/45 = 1 job.

**The other four kinds, each worked on its own screen, briefly.**
- *Fill against a drain* (4 h fill, 5 h drain): 1/4 − 1/5 = 1/20 per hour, 20 hours; the drain's parts leave the bar each hour. Sense: longer than 4. Decoy 20/9 is the sum used where the difference belongs; 9/2 is the average of the times.
- *Mixing* (4 L at 21%, 8 L at 33%): salt 0.84 + 2.64 = 3.48 L over 12 L = 0.29: 29%. Two bars end to end, lengths 4 and 8, shaded 21% and 33%; the shaded share of the joined bar is read. Sense: between 21 and 33, nearer 33 because there is more of it. Decoy 27 is the average of the percents, 71 the water.
- *Average speed* (59 miles at 50, back at 48): total distance 118; total time 59/50 + 59/48; the 59 cancels: 2 ÷ (1/50 + 1/48) = 2400/49, just under 49. Sense: more time is spent at the slower speed, so below 49; the decoy 49 is the average of the speeds. Said plainly: "distance over time, the whole trip."
- *A rate that changes* (tank at 20 L; 7 min at 11 L/min, then 3 L/min; when 123 L?): after 7 minutes, 20 + 77 = 97; 26 more liters at 3 per minute is 26/3 minutes; total 7 + 26/3 = 47/3. The one kind drawn as a graph: a steep line, then a shallower one from (7, 97). Decoys 103/11 and 103/3 pretend one pump did it all; 124/3 counts the first pump's minutes but forgets its liters.

**Fast.** Turn every "how long" into "how much per hour" before adding or subtracting; divide the whole job by the combined rate.
**Sense.** Together is faster than either alone; a drain makes it slower; a mixture lies between; a round trip averages below the mean of the speeds.
**Check.** Combined rate × answer time = one job; the mixture's salt recomputed; both legs' times added.
**Rule out.** The at-a-glance size test dims two or three choices in every kind before any arithmetic.
**Line.** "Rates add. Times do not."
**Trap.** Times added or averaged (24, 12, 49, 9/2). The bar shows hours landing parts, not hours landing hours.
**Kit.** `bar` with two inks filling together per hour (the "fill together" motion), two bars laid end to end with shaded shares; `axes` with two-piece line.
**Writer.** Strongest: five acts, each a different reading, each needing the one decoy named.

---

## `sat-entry-rate-numeric` — Rates together, numeric entry

**Standard.** HSA.CED.A.1 and HSN.Q.A.1 as above; misfiled in this family for the same reason. Four kinds: shared work, fill against a drain, a rate that changes, and the one the other type lacks: *how much to add* to reach a target strength. Numeric entry: no rule-out, but the SAT box rules must be said once (7/2 or 3.5, never "3 1/2"; 105/2 as typed).

**Foundations first.** The same job bar as `rate-combination-model`, built here too since each lesson stands alone, with 3 and 6: 1/3 + 1/6 = 2/6 + 1/6 = 1/2 of the job per hour, 2 hours. Then the balance idea for mixing: the acid in the two liquids before mixing is exactly the acid after; nothing is lost.

**Read.** Per hour or pure amount; what is asked; what the answer must be bigger or smaller than.

**The example (mixing, full).** "How many liters of 65% acid must be added to 18 liters of 20% to make 35%?" (1) Two bars: 18 L shaded 20% (acid 3.6 L), x liters shaded 65% (acid 0.65x); joined, (x + 18) L shaded 35%. (2) Acid before equals acid after: 0.65x + 3.6 = 0.35(x + 18) = 0.35x + 6.3. (3) 0.30x = 2.7, x = 9. (4) Check: 0.65 · 9 = 5.85; 5.85 + 3.6 = 9.45; 9.45 ÷ 27 = 0.35. Sense first: 35 is nearer 20 than 65 (15 away against 30), so less strong liquid than weak: under 18. Said as a second view that always works: the strong liquid is twice as far from the target, so there is half as much of it: 18 ÷ 2 = 9.

**Other kinds, each on its own screen.** Fill against a drain (15 h, 21 h): 1/15 − 1/21 = 7/105 − 5/105 = 2/105 per hour; 105/2 hours, typed 105/2 or 52.5. A rate that changes (3 min at 14, then 5): 42 after 3 minutes; 41 more at 5 is 41/5; 3 + 41/5 = 56/5. Shared work is the foundation example above.

**Fast.** Per hour before adding; acid before = acid after.
**Sense.** The mixture needs less of the liquid whose strength is farther from the target.
**Check.** Combined rate × time = 1; acid recomputed from the answer.
**Line.** "Rates add. Times do not. Acid before equals acid after."
**Trap.** Times added (3 + 6 = 9) or averaged (4.5); for mixing, averaging the percents or adding the volumes without the acid. The bars carry the acid as shaded length, so a percent is never added to a percent.
**Kit.** As the type above, plus a bar of unknown length labeled x.
**Writer.** Strongest, for the same reason; once `rate-combination-model` is approved, this lesson is its sibling and a cheaper model may write it from both concepts.

---

## `sat-fn-constraint-choice` — The equation for a total of two kinds

**Standard.** HSA.CED.A.2: "Create equations in two or more variables to represent relationships between quantities." HSA.CED.A.3: "Represent constraints by equations."

**Foundations first.** Family 7's equal groups with a letter for the count: x small candles at 14 dollars each cost 14x dollars; the unit is dollars, because dollars per candle times candles is dollars. Two kinds together: add the two amounts and set them equal to the total. Picture: a bar of the 730 dollars split into a teal part labeled 14x and a violet part labeled 28y, bracketed to 730. Units are the first filter: a choice whose left side is not in dollars cannot equal 730 dollars.

**Read.** Which letter is which kind (x small, y large) and what the total counts (dollars, kilometers, points). At a glance: two of the four choices are never dollars.

**The example.** "Small candles 14 dollars, large 28 dollars, sales 730 dollars; x small and y large." (1) Units: x/14 + y/28 is candles per dollar, nonsense; (14 + 28)(x + y) charges every candle 42 dollars. Both dim in one beat. (2) Two remain, the same numbers in two orders. Match the price to its letter: x is small, small is 14: 14x; y is large, 28y. (3) 14x + 28y = 730; the bar labels it. (4) Check by pretending a sale: 10 small and 20 large is 140 + 560 = 700 dollars; the equation gives 700. The swapped equation gives 280 + 280 = 560: wrong.

**Second worked case** (a truck full with 3 small or 7 large: a different act, the rates are hidden). A small crate fills 1/3 of the truck, a large 1/7; full means x/3 + y/7 = 1; ×21: 7x + 3y = 21. Picture: one bar of the truck cut into 3, the same bar cut into 7. Check with the two pure loads the story gives: x = 3, y = 0: 21; x = 0, y = 7: 21. The decoy 3x + 7y = 21 copies the numbers in order and fails both loads (9 and 49). Five beats.

**Fast.** Each kind: rate × its count; add; equals the total. When only pure cases are given, test each choice at both.
**Sense.** The bigger price goes with the bigger item's letter; a pure load of the stated size must make the equation true.
**Check.** A made-up sale computed by hand and by the equation agree; both pure loads satisfy the truck equation.
**Rule out.** Units first (two go), then the letter-to-price match (one goes).
**Line.** "Price times count, for each kind. Then add."
**Trap.** Swapped prices (28x + 14y); numbers copied in story order (3x + 7y) for the truck. The match is said letter by letter, and the pure loads are tested.
**Kit.** `bar` with labeled unequal parts; a bar cut into 3 and then into 7; `dim`.
**Writer.** A capable cheaper model.

---

## `linear-model-value` — Start plus rate, then solve

**Standard.** HSA.CED.A.1: "Create equations and inequalities in one variable and use them to solve problems"; 7.EE.B.4a and 4b (px + q = r; px + q > r in a story); HSA.REI.B.3 for the solving. A **mixed** type: a known total (9 + 8h = 49), two plans equal (28 + 5m = 20 + 7m), a greatest whole number under a limit (12 + 4r ≤ 45), and the misfiled rectangle. The lesson teaches reading: start, rate, and what the question asks about them.

**Foundations first.** Foundations 3, 4 and 6. Start plus rate × letter, as the bar: gold start, equal rust blocks each labeled with the rate; built for the bike rental (9 + 8h) and read as a line: "the number alone is the start, the number with the letter is per." Then the three questions a story can ask about it: how many steps to a known total; when two plans are the same height; the most steps that stay under a limit.

**Read.** The question's words gold: "cost the same" means two plans, same height; "greatest number ... has 45 dollars" means at most 45, then a whole number; "paid 49" means a known total. At a glance for plans: A starts higher (28 against 20) but climbs slower (5 against 7), so they do meet, and B is the cheaper one after.

**The example (two plans, full).** "Plan A 28 plus 5 per month; B 20 plus 7 per month; same cost when?" (1) Two bars at month 0: A's gold 28, B's gold 20; the gap is 8. (2) Each month A adds 5, B adds 7: the gap closes by 2. Bars stand up into two lines on the axes, teal and violet; the two-column table (month, A, B) runs 28/20, 33/27, 38/34, 43/41, 48/48, the tie row gold, the crossing dropped to month 4. (3) The equation is that sentence: 28 + 5m = 20 + 7m; take 5m from both: 28 = 20 + 2m; take 20: 8 = 2m; m = 4. The margin notes carry the moves. (4) 4 months. Check: both plans at 4 give 48.

**Second worked case (the limit).** "12 to enter, 4 per ride, Student A has 45; greatest number of rides?" The bar of 45: gold 12 off the front, then rides of 4 laid in: eight fit, with 1 dollar left. The inequality 12 + 4r ≤ 45; 4r ≤ 33; r ≤ 8.25; rides are whole, so 8. Check: 8 rides cost 44; 9 would cost 48, more than 45. Five beats. (The known-total story, 9 + 8h = 49, is the foundation bar with its total bracketed: 40 ÷ 8 = 5 hours; three beats if shown, or covered by the limit case's method.)

**Rectangle (if it stays).** One quick screen: the perimeter as a bar of 74 made of w, 3w + 1, w, 3w + 1: 8w + 2 = 74, w = 9. Check: 9 and 28, perimeter 74. Flagged as not this type's idea.

**Fast.** Plans: starting gap ÷ difference in rates. Limit: (limit − start) ÷ rate, then round *down* to a whole. Total: (total − start) ÷ rate.
**Sense.** The plan that starts higher and climbs slower is the one that becomes cheaper; the number of rides is less than 45 ÷ 4.
**Check.** Both plans at the answer agree; one more ride breaks the limit.
**Line.** "Same at the crossing. The gap closes by the difference in rates."
**Trap.** Adding start and rate as "the cost" (28 + 5 = 33); rounding 8.25 up to 9. The bars show the start as a different-colored block from the rate, and the ninth ride does not fit in the bar.
**Kit.** `bar` parts and `stand`; two-column `table` with `tie`; `meet` with the gold drop. Nothing beyond the family's tools.
**Writer.** Strongest: three stories asking three different questions of one picture, and the example choice decides whether the lesson teaches reading or a recipe.
