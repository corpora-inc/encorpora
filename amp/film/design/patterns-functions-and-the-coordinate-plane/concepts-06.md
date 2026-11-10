# Patterns, functions and the coordinate plane, part 6: Algebra 1 sequences, rate of change and solution sets

Ten problem types in three groups. Each group shares one opening, built in front of the learner in the first lesson of the group and said in a shorter form in the others; a learner who sees only one film still gets the foundation.

- **The ladder** (`recursion-term-steps`, `nonlinear-recursion-term`, `arithmetic-distant-term`): a sequence is a function on the positions 1, 2, 3, …; a recursive rule is a ladder climbed rung by rung; an explicit rule is a count of jumps.
- **The triangle** (the four `average-rate-*` types): average rate of change is the slope triangle between two points of any graph, in output units per input unit.
- **On the graph means true** (`solution-point-choice`, `solution-coordinate`, `intercept-point-choice`): the graph of an equation is the picture of all its solutions; a point is on it exactly when its two numbers make the equation true.

Before the concepts, what is misfiled.

- **`nonlinear-recursion-term`** sits in the skill `arithmetic-sequences`, but its sequences are not arithmetic (nothing is added at a constant step; the previous term is squared). It serves HSF.IF.A.3, not HSF.IF.A.2 as judged, and it is the same lesson as `recursion-term-steps` with a negative start and one answer box instead of slots. Keep it, re-shelve it under a sequences-as-functions skill, and let its film point back to the ladder.
- **`average-rate-steps`** and **`average-rate-table-rounded`** are one problem type in two answer formats (slots versus one box). Two films, one concept; the examples below are chosen so the two films show different things (a rate that falls through a value that first rose; a value that falls steadily).
- **`arithmetic-sequences`** is linked to HSF.BF.A.2, which asks the learner to *write* rules recursively and explicitly and translate between them. None of these three types writes a rule. The gap belongs on the alignment list; the films teach the translation anyway in one beat where it is natural (`arithmetic-distant-term`).
- The brief shows no cells for the tables in `average-rate-display`; the numbers below are chosen to match the printed answers, and the writer takes the real cells from `facts.ts`.

---

## Arithmetic sequences (`arithmetic-sequences`, Algebra 1)

### `recursion-term-steps` — Climb a recursive rule one term at a time

**Standard.** HSF.IF.A.3: "Recognize that sequences are functions, sometimes defined recursively, whose domain is a subset of the integers." HSF.IF.A.2 for the evaluating: "evaluate functions for inputs in their domains."

**Foundations first.** Define *sequence* (a list of numbers in order), *term* (one number in the list) and *position* (first, second, third; the small number in a₁, a₂, a₃ is the position, never something to multiply by). Say the family line once: a sequence is a function whose inputs are the positions, so a₃ means "the output at position 3." Define a *recursive rule*: it tells how to make each term from the term just before it; aₙ₋₁ is read "the term before." Build the picture: the **ladder**, rungs labeled a₁, a₂, a₃, a₄ from the bottom, a teal rule arrow between each pair of rungs with the operation riding it ("× 2, + 5"). Then the point of the picture, said plainly: the rule has no way to jump. To know a₄ you must stand on a₃, and to stand on a₃ you must have stood on a₂. Every rung gets written.

**Read.** "A sequence has a₁ = 5 and aₙ = 2aₙ₋₁ + 5. Find a₄, showing each term you need." Gold on *a₄* and on *each term*. The answer is three numbers, one per rung above the first, and the last one is a₄. At a glance: a₄ is three rungs up, so three computations; the rule doubles and adds, so each term is more than twice the one before.

**The example.** a₁ = 5, aₙ = 2aₙ₋₁ + 5, find a₄. (1) The ladder with 5 on the bottom rung; the arrow reads "× 2, + 5". (2) Rung 2: the 5 slides up the arrow; on the board a₂ = 2(5) + 5 = 10 + 5 = 15; the 15 lands on its rung and the first slot fills. (3) Rung 3: the 15, not the 5, slides up: a₃ = 2(15) + 5 = 35. (4) Rung 4: a₄ = 2(35) + 5 = 75. Each rung's number is the one that goes into the next arrow; the camera stays on the rung being climbed. **Quick second case, a different rule kind:** a₁ = 2, aₙ = (aₙ₋₁)² + 2, find a₃: the arrow reads "square, then + 2"; a₂ = (2)² + 2 = 6; a₃ = (6)² + 2 = 38. Square first, then add: the exponent belongs to the term alone.

**Fast.** There is no shortcut and the lesson says so: write every term from a₁ to the one asked, each from the one just before.

**Sense.** The rule says "double and add," so each term should be more than double the last: 5, 15, 35, 75 grow the way the rule promises.

**Check.** Count the rungs: a₄ took three computations. Run the last arrow once more in your head from the term before: 2(35) + 5 = 75. When "some steps are filled in," the filled step is a free check: it must come out of your previous rung.

**Line.** "To reach a rung, you must stand on the one below it."

**Trap.** Putting a₁ into the rule every time (15, 15, 15), or applying the rule once and writing the result as the term asked. The ladder makes it impossible: the number that travels up each arrow is visibly the one that just landed on the rung below, and the board writes each substitution with the previous term inside its parentheses.

**Kit.** `chain` turned vertical (a ladder): rungs with values, arrows with riding operations, `run` that slides the latest value up one arrow and fills the next rung, one rung per word.

**Writer.** A capable cheaper model: one method, a fixed path, every number checkable by `--dry`.

---

### `nonlinear-recursion-term` — The ladder with a negative start

**Standard.** HSF.IF.A.3 (as above); HSF.IF.A.2 for the evaluating. Misfiled under arithmetic sequences and judged to serve only A.2; see the note at the top.

**Foundations first.** The same ladder, built in half the time: sequence, position, the rule arrow between rungs, "you cannot jump." One new beat: when the term on a rung is negative it goes into the rule *inside parentheses*, because the square belongs to the whole term, and squaring a negative gives a positive.

**Read.** "a₁ = −2 and aₙ = 2aₙ₋₁² − 5. What is a₃?" Gold on *a₃*. The answer is one number, two rungs up. At a glance: a square is never negative, so every term from a₂ on is at least −5; and 2aₙ₋₁² means "square the term, then double it," because the exponent sits on a, not on 2a.

**The example.** a₁ = −2, aₙ = 2aₙ₋₁² − 5, find a₃. (1) Ladder with −2 on the bottom rung; the arrow reads "square, × 2, − 5". (2) The −2 slides up in parentheses: a₂ = 2(−2)² − 5. The board does the square first and writes it: 2(4) − 5 = 8 − 5 = 3. The 3 lands on rung 2. (3) The 3 slides up: a₃ = 2(3)² − 5 = 2(9) − 5 = 13. (4) a₃ = 13.

**Fast.** None beyond the ladder; two rungs, two computations, parentheses around whatever is on the rung.

**Sense.** Once a term is past 1 in size, squaring makes the next one bigger: 3 to 13 is the right direction, and 13 is more than −5, the least this rule can ever give.

**Check.** Run rung 2 again from a₁ (2 · 4 − 5 = 3) and rung 3 from a₂ (2 · 9 − 5 = 13); or take the answer backward one rung: 13 + 5 = 18, 18 ÷ 2 = 9, and 9 is 3 squared.

**Line.** "Square first, and square the whole term, parentheses and all."

**Trap.** Two real ones. (−2)² taken as −4 ("the minus survives"), giving 2(−4) − 5 = −13; and 2aₙ₋₁² read as (2 · −2)² = 16, giving 11. The board kills both: the parentheses are written before anything else, the square is evaluated on its own line to 4, and the voice says "square the term, then double" while the arrow's label shows the operations in that order.

**Kit.** The ladder as above.

**Writer.** A capable cheaper model, for the same reason as `recursion-term-steps`.

---

### `arithmetic-distant-term` — The twenty-fourth term is twenty-three jumps

**Standard.** HSF.LE.A.2: "Construct linear ... functions, including arithmetic ... sequences, given ... two input-output pairs (include reading these from a table)." HSF.BF.A.2 in part: the explicit formula is used, though the learner never has to write it in the app.

**Foundations first.** Define *arithmetic sequence*: the same number is added every time; that number is the *common difference* d, and it can be negative or a decimal. Build the **strip** from family foundation 2: positions 1, 2, 3, 4 across the top in blue, terms −10, −13, −16, −19 beneath in rust, an arc above each pair of neighbors labeled "−3." Then the family's own line, with the arcs counted on the words: the first term has had no jumps, the second one jump, the fourth three jumps. The strip is cut with a dotted gap and position 24 appears at the far end; a bracket from position 1 to position 24 counts the arcs under it: 23. The explicit rule, aₙ = a₁ + (n − 1)d, is written under the bracket as what the bracket says: start, plus a jump for every arc. One beat translates: the recursive form "aₙ = aₙ₋₁ − 3" is the same sequence told one arc at a time (the BF.A.2 translation, since the app never asks it).

**Read.** "The first four terms are −10, −13, −16, −19, … What is the 24th term, a₂₄?" Choices −76 | 59 | −82 | −79. Gold on *24th*. The answer is one of the choices and is far below −10, since the terms are falling. At a glance: the step is −3; 23 jumps of 3 is about 70, so the answer is near −80. That leaves three choices one jump apart; only the count of arcs can separate them.

**The example.** (1) d: later minus earlier, −13 − (−10) = −3; a second pair agrees, −16 − (−13) = −3. The arcs carry the label. (2) From position 1 to position 24: the bracket reads 23 jumps, not 24. (3) 23 × (−3) = −69 on the board. (4) a₂₄ = −10 + (−69) = −79. (5) The formula line, written once: a₂₄ = −10 + (24 − 1)(−3) = −79.

**Fast.** a₁ + (n − 1)d, with d found as later minus earlier. Always works, in either direction, for decimals too (−3.0, −3.6, … has d = −0.6; nothing changes).

**Sense.** The sequence falls, so the term is well below −10; twenty-some jumps of 3 is around 70; −79 is the right size.

**Check.** Start from a₄ = −19 instead: position 4 to position 24 is 20 jumps, 20 × (−3) = −60, and −19 − 60 = −79. Two routes, one answer. (A round count of jumps also explains the last digit: sixty more takes nothing from the ones, so a₂₄ ends in 9 just as a₄ does.)

**Rule out.** 59 is above the start while every term falls: dimmed alone, "wrong direction." −76 is 22 jumps and −82 is 24; they differ from −79 by exactly one step each, which is the whole lesson: the bracket's count decides, and the lesson says so as they dim.

**Line.** "The twenty-fourth term is twenty-three jumps."

**Trap.** a₁ + 24d (counting terms, not jumps), giving −82; and d taken as +3 by subtracting the wrong way. The bracket over the strip counts arcs and nothing else; d is written as "later minus earlier" on the board with the negatives in parentheses.

**Kit.** The strip (table with arcs, already specified) gains an elided middle: a dotted gap between position 4 and position n, and a `bracket` over a run of positions whose label counts the arcs under it. `dim`.

**Writer.** A capable cheaper model: the picture is a named part and the arithmetic is checkable; the off-by-one is handled by the concept.

---

## Average rate of change (`average-rate-change`, Algebra 1)

### `average-rate-formula` — The slope triangle on any rule

**Standard.** HSF.IF.B.6: "Calculate and interpret the average rate of change of a function (presented symbolically ...) over a specified interval."

**Foundations first.** This is the group's full opening; the other three films say it in a shorter form. Define *average rate of change* in plain words: how much the output changed for each unit the input changed, on average, from one input to another. Build it: the graph of a rule (teal), two points marked at the two inputs, the **slope triangle** drawn between them with the run along the bottom in blue, the rise up the side in rust, both labeled with their lengths, and the straight line through the two points dashed. Name it: this is rise over run from family 14, the slope of the line through those two points, and that slope is the average rate of change. Say why "average": the curve may bend between the points, but the straight line from one to the other has one steepness, and that is what the number reports. Then the formula as the triangle written in letters: [f(b) − f(a)] over [b − a], the top in rust, the bottom in blue.

**Read.** "For f(x) = 3x² − 8, what is the average rate of change of f from x = −2 to x = 0?" Gold on the two inputs. The answer is one number with a sign. At a glance: the rule needs both outputs before anything else, and because the second output will be lower than the first (3 · 0 − 8 is −8; 3 · 4 − 8 is positive), the rate is negative.

**The example.** (1) f(−2) = 3(−2)² − 8 = 3(4) − 8 = 4; the point (−2, 4) is marked on the parabola. (2) f(0) = 3(0)² − 8 = −8; the point (0, −8). (3) The triangle: run from −2 to 0 is 0 − (−2) = 2, blue, labeled 2; rise from 4 to −8 is −8 − 4 = −12, rust, labeled −12 and pointing down. (4) The fraction in the triangle's colors: −12 over 2 = −6. (5) The dashed line through the two points falls to the right: a negative rate. **Quick second case, a different kind of rule:** f(x) = 4 · 2ˣ from 2 to 4: f(2) = 16, f(4) = 64, rise 48 over run 2, rate 24; the curve is exponential but the triangle is the same triangle.

**Fast.** Write the two points first, (a, f(a)) and (b, f(b)); then later minus earlier on top and on the bottom; then divide. The order on top must match the order on the bottom.

**Sense.** The second point is lower than the first, so the answer must be negative; a drop of 12 across a width of 2 is 6 per unit, and the triangle on screen is visibly three times as tall as it is wide, falling.

**Check.** Walk the triangle: from (−2, 4), go right 2 and down 12, and you land on (0, −8). Or subtract in the other order on both lines: (4 − (−8)) over (−2 − 0) = 12 over −2 = −6, the same.

**Line.** "Average rate of change is the slope between the two points."

**Trap.** Three, all real. 3(−2)² computed as −12 (the minus kept through the square); the run written as 0 − 2 = −2 so the rate comes out +6 (orders mismatched); and the answer left as −12, the total change, with no division. The board writes (−2) in parentheses and squares on its own line; the two subtractions are written one under the other, later minus earlier in both, in the two colors; and the triangle's two labeled legs make the division visible.

**Kit.** `slopetri` as specified (run blue, rise rust, labels, dashed secant), on a `plot` of any expression; `stretch` for tall parabolas.

**Writer.** A capable cheaper model: one method, a named picture, every number checked by the dry run.

---

### `average-rate-display` — Read the two points, then the triangle

**Standard.** HSF.IF.B.6: "Calculate and interpret the average rate of change of a function (presented ... as a table) over a specified interval. Estimate the rate of change from a graph."

**Foundations first.** The thirty-second version of the group's opening: two marked points on a graph, the slope triangle drawn between them in its two colors, "the average rate of change is the slope between the two points, rise over run, output change per unit of input." One new beat for this type: when the function comes as a table, each row is a point, so two rows give the same triangle; the picture shows two table rows lighting gold and becoming two dots.

**Read.** Graph case: "The graph of y = f(x) passes through A at x = −6 and B at x = −4. What is the average rate of change of f from x = −6 to x = −4?" Gold on A and B. The answer is one number with a sign. At a glance: B is higher than A on the picture, so the rate is positive; the run is 2 before anything is read.

**The example (graph).** The app's own curve with A and B marked; the writer takes the real coordinates, here A(−6, −1) and B(−4, 5). (1) Shadow A to both axes: x = −6, y = −1; the pair is written. (2) Shadow B: (−4, 5). (3) The triangle: run −4 − (−6) = 2 in blue; rise 5 − (−1) = 6 in rust; both labeled on the picture. (4) 6 over 2 = 3. The curve may dip or bend between A and B; the dashed line through them rises 3 for every 1 across, and that is the average. **Quick second case (table, with units):** "The table shows the temperature T, in degrees, h hours after 6 a.m. What is the average rate of change of T, in degrees per hour, from h = 2 to h = 4?" The rows h = 2 and h = 4 light gold (say 58° and 62°); the other rows dim; rise 4 degrees, run 2 hours, 2 degrees per hour. Said as a sentence: on average the temperature rose two degrees each hour between 8 and 10 a.m.

**Fast.** Read both outputs first (shadows on the graph, the lit cells in the table); then later minus earlier over later minus earlier.

**Sense.** The sign from which point is higher; the size from the triangle's shape (three times taller than wide here).

**Check.** From A, go right 2 and up 6; you land on B. In the table, 58 + 2 · 2 = 62.

**Line.** "Two points, one triangle, rise over run."

**Trap.** Reading the sign from the curve's shape between the points ("it dips, so negative") instead of from the two endpoints; forgetting to divide and answering the rise; miscounting a coordinate by counting grid lines. The shadows land the values on the axes, the triangle's two legs are labeled, and the voice says once that only A and B matter, the curve between them does not.

**Kit.** `slopetri`; `shadow`; the table's `given` to light two rows and dim the rest; `link` from a row to its point.

**Writer.** A capable cheaper model, with the real figure and table taken from `facts.ts`.

---

### `average-rate-table-rounded` — Two rows of a table, dollars per year

**Standard.** HSF.IF.B.6: "Calculate and interpret the average rate of change of a function (presented ... as a table) over a specified interval."

**Foundations first.** The short opening: average rate of change is output change per unit of input, the slope between two points. Then the table as points: each row is a point; the two rows the question names become two dots on a plane whose axes carry the table's names and units ("Age (years)", "Value (dollars)"), and the triangle between them is the same triangle. The rows in between are other points; they do not enter the average.

**Read.** "The table shows the value, in dollars, of a delivery van at different ages in years. What is the average rate of change in its value from year 0 to year 6, in dollars per year, to the nearest tenth?" Gold on *year 0*, *year 6*, *per year* and *nearest tenth*. The answer is a signed number with one decimal place, in dollars per year. At a glance: the value falls as the van ages, so the rate is negative; the run is 6 years, not the number of rows between.

**The example.** The writer takes the real cells; here ages 0, 2, 4, 6, 8 with values 25,000; 23,410; 21,860; 20,297; 18,750. (1) The rows for ages 0 and 6 light gold; the rest dim. (2) Beside the age column: 6 − 0 = 6 years. (3) Beside the value column: 20,297 − 25,000 = −4,703 dollars. (4) The two rows become two dots on the plane, the triangle between them with run 6 and rise −4,703. (5) −4,703 over 6 = −783.83…, rounded at the end to −783.8. (6) Said as a sentence: the van lost about 784 dollars of value each year, on average.

**Fast.** Light the two rows; later minus earlier in both columns; divide; round once, at the end; keep the sign.

**Sense.** About 4,700 spread over 6 years is a little under 800 a year, and the value went down, so negative.

**Check.** −783.8 × 6 = −4,702.8, within a dollar of −4,703 (the rounding accounts for the gap). The rising-value case (a population from 1990 to 2010) is the same steps with a positive answer.

**Line.** "Later minus earlier, top and bottom; divide; round last."

**Trap.** Dividing by the number of rows between the two (here 3) instead of the years (6), because the rows are evenly spaced; dropping the sign because "a rate can't be negative"; rounding the difference or the quotient early. The age difference is written beside the age column as years, the dashed line in the picture falls, and the quotient is shown to two decimals before it is rounded.

**Kit.** Table `given` and `diff` (a difference written beside a column for two chosen rows); `link` rows to points with the triangle between them.

**Writer.** A capable cheaper model.

---

### `average-rate-steps` — The average ignores the bumps between

**Standard.** HSF.IF.B.6 as above, and its "interpret" clause: this film says what the number means.

**Foundations first.** The short opening, then the one idea this type adds: the *average* rate from one year to another is the straight line from the first point to the last, even when the quantity rose and fell in between. The picture: the recorded values plotted as dots against years, the dashed line from the first named year to the last, and the dots between it sitting above or below the line. The slots in the problem are the three parts of the triangle: the rise, the run, and rise over run.

**Read.** "A park's annual visitors were recorded every 5 years (2000: 1,165,407; 2005: 1,228,089; 2010: 1,301,743; 2015: 1,217,626; 2020: 1,240,993). Find the average rate of change of the annual visitors per year between 2005 and 2015, rounded to the nearest integer. Enter each step." Gold on *2005*, *2015*, *per year*. Three answers: the change in visitors, the change in years, the rate. At a glance: 2015 is lower than 2005, so the change and the rate are negative; the run is 10 years.

**The example.** (1) The list becomes a two-column table (Year blue, Visitors rust); the 2005 and 2015 rows light gold, the others dim. (2) The five points plotted to scale; the 2010 point sits highest, above the dashed line from 2005 to 2015, and the voice says that the average does not see it. (3) Change in visitors: 1,217,626 − 1,228,089 = −10,463: slot one. (4) Change in years: 2015 − 2005 = 10: slot two. (5) −10,463 over 10 = −1,046.3, rounded to −1,046: slot three. (6) The sentence: over those ten years the park lost about 1,046 visitors a year on average, even though visitors went up first.

**Fast.** Later minus earlier for the quantity; later minus earlier for the years; divide; round only the last number.

**Sense.** About ten thousand fewer over ten years is about a thousand a year, negative.

**Check.** −1,046 × 10 = −10,460, within a few of −10,463. When a step is filled in, it must agree with your subtraction.

**Line.** "The average is the line from end to end; the bumps between do not count."

**Trap.** Subtracting earlier minus later (+10,463) because the bigger number "comes first"; dividing by 2 (two intervals) instead of 10 years; answering the change and stopping. The table's year column shows the run as years; both subtractions are written later minus earlier, one under the other; the third slot is visibly a division.

**Kit.** A table built live from prose; `given`; points with the dashed secant and the triangle.

**Writer.** A capable cheaper model.

---

## Graph solution sets (`graph-solution-sets`, Algebra 1)

### `solution-point-choice` — On the graph means it makes the equation true

**Standard.** HSA.REI.D.10: "Understand that the graph of an equation in two variables is the set of all its solutions plotted in the coordinate plane, often forming a curve (which could be a line)."

**Foundations first.** This is the group's full opening. Define a *solution* of an equation in x and y: a pair of numbers, x first, that makes the equation true. Build the graph from solutions: for y = |x − 3| + 3, define |x − 3| in one line (the distance from x to 3, never negative), make a small table (x = 0, 1, 3, 5, 6 with y = 6, 5, 3, 5, 6), send each row out as a dot, and let the V appear through them. Say the standard's own idea: the graph is every solution drawn; a pair that makes the equation true lands on the curve, a pair that does not lands off it. So "is this point on the graph" is a test you can do without drawing: put the first number in for x and the second for y and see if the statement is true.

**Read.** "Which point is on the graph of y = |x − 3| + 3?" Choices (8, −2) | (−2, 8) | (2, 8) | (−2, 9). Gold on *on the graph*. The answer is one pair; the first number goes into x. At a glance: |x − 3| is never negative, so y is at least 3: (8, −2) cannot be on the graph. Two choices share x = −2, so computing y at −2 once settles both.

**The example.** (1) Test (−2, 8): x = −2 in blue, y = 8 in rust, written into the equation: 8 = |−2 − 3| + 3. (2) Inside first: −2 − 3 = −5; |−5| = 5; 5 + 3 = 8; 8 = 8, true. (3) The point (−2, 8) plotted, across −2 then up 8, landing on the V. (4) The others seen off the curve: at x = 2 the V is at 4, so (2, 8) floats above it; (−2, 9) sits one above the curve. **Quick second case, both letters on one side:** "Which point is on the graph of −4x − 4y = 20?" with (3, −8): −4(3) − 4(−8) = −12 + 32 = 20, true. No solving needed; the test is the same when the equation is not "y =".

**Fast.** Substitute, first number for x, second for y. When several choices share an x, compute y once and match. The glance (the least y a rule can give; the sign of −x² at any x) throws out choices before any substitution.

**Sense.** The point sits where the picture says it should: on the right arm of the V, higher than the vertex.

**Check.** Plot the chosen pair on the drawn graph and see it land on the curve; read the true statement aloud, "eight equals five plus three."

**Rule out.** (8, −2) has a y below the rule's minimum: dimmed, "this rule never gives a y under 3." (8, −2) is also the swap of the correct pair, and the lesson says so: the first number is x. (2, 8) and (−2, 9) dim when the computed y at x = −2 is 8 and at x = 2 is 4.

**Line.** "On the graph means it makes the equation true."

**Trap.** Putting the pair in backward (8 for x, −2 for y), and |−5| taken as −5; for −x² − 4x + 4 at x = 3, −(3)² read as +9. The substitution is written in the two colors with the first number in x, the inside of the absolute value finished on its own line before the bars come off, and the square written with parentheses.

**Kit.** `plot` of absolute-value and quadratic rules (exists); `link` table rows to dots; `dim`.

**Writer.** A capable cheaper model: one test, named decoys, every line checkable.

---

### `solution-coordinate` — The missing number is where the known one's line meets the graph

**Standard.** HSA.REI.D.10, the same clause; the point is on the graph, so the pair is a solution, so the missing number makes the equation true.

**Foundations first.** The short opening: on the graph means true. One new picture: when one coordinate is known, draw its line. If x = −1 is known, the dashed gold vertical line x = −1 crosses the graph in exactly one place (for a function), and the height of that crossing is k. If y = 3 is known, the dashed horizontal line y = 3 crosses the line at one x, and that x is k. The algebra is the same move: substitute the known number for its letter and solve what is left for the other.

**Read.** Case A: "The point (−1, k) is on the graph of y = −x² − x − 3. What is k?" Gold on *(−1, k)*: the first number is x, so k is a y. At a glance: the rule begins with −x², so for any x the first term is negative or zero; k will be negative. Case B: "The point (k, 3) is on the graph of −3x + 2y = 1. What is k?" Here 3 is the second number, so it is y, and k is an x.

**The example (case A).** (1) The parabola, opening down, drawn; the dashed line x = −1 falls from the axis to the curve. (2) y = −(−1)² − (−1) − 3, with (−1) in parentheses each time. (3) The square first: (−1)² = 1, so −1; then −(−1) = +1; so −1 + 1 − 3 = −3. (4) k = −3; the dot is placed at (−1, −3), on the curve where the dashed line meets it. **Second example, fully worked, because the missing number is x and the answer is a fraction:** (1) The line −3x + 2y = 1 drawn; the dashed horizontal line y = 3. (2) 3 goes in for y: −3k + 2(3) = 1, so −3k + 6 = 1. (3) Undo in reverse order (family 11): −3k = −5, k = 5/3. (4) The dot at (5/3, 3), between the grid lines at 1 and 2 and nearer 2, exactly where the dashed line meets the graph. A fraction stays a fraction; the picture agrees with it.

**Fast.** Substitute the known coordinate for its letter (first number is x, second is y), then solve the one-letter equation left.

**Sense.** The sign from the glance (−x² leads, so negative); the position from the picture (the crossing is between 1 and 2).

**Check.** Put both numbers back: −3(5/3) + 2(3) = −5 + 6 = 1, true. Case A: −(−1)² − (−1) − 3 = −3, true.

**Line.** "Substitute what you know; solve for what you don't."

**Trap.** −(−1)² as +1; in case B, 3 put in for x because it is the only number given; a fraction answer rounded to a decimal. The pair is colored, first number blue into x, second rust into y; the square is done on its own line inside parentheses; the fraction is kept and shown on the picture as a point between grid lines.

**Kit.** `vline` and `hline` parts with the `meet` point (specified); `dim` not needed.

**Writer.** A capable cheaper model.

---

### `intercept-point-choice` — An intercept is a point with a zero in it

**Standard.** HSA.REI.D.10 by way of foundation 10 (an intercept is a solution with a zero coordinate); it more directly practices HSF.IF.C.7a, "graph linear ... functions and show intercepts," which the alignment list should add.

**Foundations first.** Define *intercept*: the point where a graph crosses an axis. Build the key fact on the picture: every point on the x axis has height 0, so the x-intercept is the point with y = 0; every point on the y axis has x = 0, so the y-intercept is the point with x = 0. Shadow a point on each axis to show its zero. Then the two questions as one move: to find where the line meets an axis, set the *other* coordinate to 0 and solve. Define *zero of a function*: the x at which f(x) = 0, which is the x-intercept's x-coordinate, a single number, not a pair. Say the family's reading habit: the answer may be asked as a point, as a zero, or as a sum, and the problem's last sentence says which.

**Read.** "A line has the equation y = (1/5)x − 5. It crosses the x-axis at P and the y-axis at Q. What is the sum of the nonzero coordinate of P and the nonzero coordinate of Q?" Choices 30 | −20 | −5 | 20. Gold on *x-axis*, *y-axis*, *sum*. The answer is one number: P's x plus Q's y. At a glance: Q is where x = 0, so Q's y is the −5 in the rule, below the axis; the line climbs only 1 for every 5 across, so from −5 it needs 25 across to reach the axis: P is far to the right and positive. A positive 25 plus a negative 5 is positive and smaller than 25.

**The example.** (1) Q: x = 0, y = (1/5)(0) − 5 = −5; Q = (0, −5), marked where the line meets the y axis. (2) P: y = 0, so 0 = (1/5)x − 5; add 5 to both sides, 5 = (1/5)x; multiply both sides by 5, x = 25; P = (25, 0), marked on the x axis. The line is drawn to its true slope across the wide view, so the 25 is seen. (3) Sum: 25 + (−5) = 20. **Quick second case, the word "zero":** "The line 3x − 4y = 1 is the graph of a linear function f. What is the zero of f?" Choices 1 | 1/4 | −1/4 | 1/3. The zero is the x where y = 0: 3x − 4(0) = 1, 3x = 1, x = 1/3; the decoy −1/4 is the y-intercept (x = 0 gives −4y = 1), the other axis. **Quick third case, reading a graph:** "Which ordered pair is its x-intercept?" The crossing on the x axis is 3 across and 0 up: (3, 0), the zero in the second slot; (0, 3) is the same numbers on the wrong axis.

**Fast.** y-intercept: set x = 0 (in y = mx + b it is simply b). x-intercept: set y = 0 and solve, undoing in reverse order; a fraction stays a fraction. Then answer in the form asked.

**Sense.** Q is below the axis, so its coordinate is negative; P is right of the origin and far, since the slope is shallow; the picture shows both.

**Check.** Substitute each intercept back: (1/5)(25) − 5 = 0, true; 3(1/3) − 4(0) = 1, true.

**Rule out.** −20 and −5 are negative while the big coordinate is positive: dimmed together, "P is far to the right." 30 is 25 + 5 with Q's sign dropped: dimmed when Q's −5 is read off the picture below the axis. For the zero: 1 is the constant, 1/4 and −1/4 come from setting x to 0 (the y-intercept), not y: "the zero is an x."

**Line.** "An intercept is a point with a zero in it: on the x axis, y is zero."

**Trap.** Setting x = 0 to find the x-intercept (the name sounds like "x is zero"); writing the x-intercept as (0, 3); calling the y-intercept the zero. The shadow shows the point on the x axis has height 0; the pair is written with its 0 in the rust slot; "zero of f" is defined on the picture as the x where the line touches the x axis.

**Kit.** `shadow`; `stretch` or a wide `view` so a shallow line reaches x = 25 to scale; `dim`.

**Writer.** A capable cheaper model with a strong review: the method is one, but the type asks in three forms and turns on a vocabulary knot (zero, intercept, which axis) that the concept has already untied.