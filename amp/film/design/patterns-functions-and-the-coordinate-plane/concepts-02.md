# Related patterns and the first quadrant, grade 5: lesson concepts

Ten problem types in two skills. Both skills stand on foundations 1, 2, 3 and 4 of the family design: the rule arrow, the strip with its counted arcs, "across, then up," and pairs that become points. Everything below is written for a fifth grader: "the number that goes in" and "the number that comes out" until the problem itself writes x and y, and then, once, "x is the in-number, y is the out-number."

**Shared openings.** Every film in `related-patterns` opens with the same thirty-second build: a pattern is a rule run from a start, drawn as a strip (positions 1, 2, 3 … in blue across the top, terms in rust beneath, an arc between neighbors labeled with the step); two strips one above the other, aligned on the positions; "matching terms" are the two terms in the same column, and a gold column highlight shows what "matching" means. Every film in `coordinate-first-quadrant` opens with the same forty-second build: a number line laid flat (blue), a second number line standing up from its zero (rust); the two zeros are one point, the origin; the flat one is the x axis, the standing one the y axis; a pair of numbers in parentheses is an ordered pair, and it is an address: the first number says how far across, the second how far up. The build is drawn on the app's own grid so the lesson's plane is the problem's plane.

---

## Related patterns (grade 5, 5.OA.B.3)

### `staar-table-rule-choice` — Which table follows the rule?

**Off grade, flagged first.** The rules are written y = x − 5 and y = 8x: letters standing for numbers are 6.EE.A.2. Fine at grade 5 once the film defines the letters. The decoy table −1, −3, −5, −7 puts negatives in front of fifth graders (6.NS); replace that decoy with one built from a nearby wrong rule (x − 4 or 5 + x).

**Standard.** 6.EE.A.2c, "evaluate expressions at specific values of their variables," in service of 5.OA.B.3's "generate … patterns using … given rules." The practiced act is: run a rule on each input and compare.
**Foundations first.** The table in the problem's own layout: x across the top in blue, y beneath in rust. "x is the in-number, y is the out-number." The rule arrow: a teal arrow from an x cell down to its y cell with the operation riding it, "+ 4". A table "follows the rule" only if every x cell, sent down its arrow, lands on the y cell under it. Pair by pair; one miss and the table is out.
**Read.** "Which table shows that every pair follows y = x + 4?" The word "every" goes gold: one wrong pair is enough to throw a table out. At a glance: the first x is 2, so the first y must be 6; any table whose first y is not 6 is gone before anything else is checked.
**The example.** Rule y = x + 4; x: 2, 3, 4, 5. Choices: y: 8, 12, 16, 20 | 5, 6, 7, 8 | 7, 8, 9, 10 | 6, 7, 8, 9. (1) Define the arrow: 2 slides along "+ 4" and 6 appears in a gold "?" cell beside the rule. (2) Look only at the first column of each table: 8, 5, 7, 6. Three are not 6; they dim together. (3) The one left: run all four arrows, 2 → 6, 3 → 7, 4 → 8, 5 → 9, each landing on the y already written there. Every pair follows. (4) The fourth table.
**Fast.** Run the rule on the first x; dim every table whose first y is wrong; prove the survivor on every pair. If two survive, the second x decides.
**Sense.** Plus 4 makes each out-number a little bigger than its in-number, by the same amount every time.
**Check.** Run the arrow backward on the last pair: 9 − 4 = 5, the x above it.
**Rule out.** Three tables die on the first column in one beat. Say what the first table is: 8, 12, 16, 20 is y = 4 × x, "times four, not plus four."
**Line.** "Every pair, down its own arrow."
**Trap.** Choosing 8, 12, 16, 20 because "it adds 4": the y row goes up by 4 each step, which is the only kind of pattern a grade-4 child has met. The rule arrow runs across from x to y, never down the y row; the film draws it that way and says once, "the rule connects each in-number to its own out-number, not one out-number to the next."
**Kit.** Four tables as choices in the problem card, each with a highlightable first column, dimmed together; `rule` and `run` on a rows-oriented `table`.
**Writer.** Cheaper model: one method, one named action, the math check verifies every cell.

### `related-patterns-relationship` — Two patterns from 0

**Standard.** 5.OA.B.3: "Identify apparent relationships between corresponding terms … observe that the terms in one sequence are twice the corresponding terms in the other sequence. Explain informally why this is so." Both variants start at 0, exactly the standard's own example.
**Foundations first.** The shared opening, then: when both patterns start at 0, matching terms have had the same number of jumps. So comparing matching terms is comparing one jump against one jump.
**Read.** Two shapes of question: "each term of B is how many times the matching term of A?" (the multiplier) and "which term of B matches 35 in A?" (use the multiplier). The gold word is "matching": same column. At a glance: B's step is bigger, so every B term is bigger than its A term, and B's step ÷ A's step is a whole number in the app.
**The example.** A starts at 0 and adds 5; B starts at 0 and adds 15; which term of B matches 35 in A? (1) Strip A, arcs "+5," counted aloud to 35: seven jumps. Strip B beneath, aligned, arcs "+15." (2) Why: one B arc is drawn as three A arcs stacked end to end: 15 is 5 + 5 + 5. Every column has the same number of jumps, and each of B's is three of A's, so every B term is three of its A term. Under the strips the pairs: (0, 0), (5, 15), (10, 30), (15, 45); 15 ÷ 5, 30 ÷ 10, 45 ÷ 15 all 3. (3) The gold column: 35 above, so 3 × 35 = 105 beneath. (4) Plot the first four pairs on the app's plane (A across in blue, B up in rust): the dots line up in a straight line from the origin. The standard asks for this and no variant does; one beat.
Quick second case: A adds 5, B adds 25: 25 ÷ 5 = 5. One beat on the strips, the quotient row reading 5, 5, 5.
**Fast.** B's step ÷ A's step is the multiplier; multiply the A term by it.
**Sense.** B grows faster, so B's term is bigger than 35; three times bigger is 105.
**Check.** 35 is seven jumps of 5; seven jumps of 15 is 105. Or 105 ÷ 35 = 3.
**Line.** "Same number of jumps; each of B's jumps is three of A's."
**Trap.** "B is 10 more than A," from 15 − 5. Children compare steps by subtracting because grade-4 patterns were all about differences. A difference row under the pairs reads 0, 10, 20, 30, growing; the quotient row reads 3, 3, 3, 3. The one that stays the same is the relationship. A second slip: answering 7, the position. The gold lands on the rust cell, never on the blue one.
**Kit.** `arcs` with `count`, a stacked-arcs comparison (one B arc shown as three A arcs), `diff`/quotient rows under paired cells, `link` from a pair to its dot.
**Writer.** Cheaper model, provided the stacked-arc action exists; otherwise the "why" is described instead of shown and the lesson fails the standard.

### `pattern-pair-relationship` — Pairs, and what connects them

**Standard.** 5.OA.B.3, all of it: "Generate two numerical patterns using two given rules. Identify apparent relationships between corresponding terms. Form ordered pairs … graph the ordered pairs … Explain informally why this is so." The starts here are not 0, a stretch past the standard's example but inside its words. The app's method mentions a "times 8 and add 2" case; no variant shows one, and that is 8.F.B.4. If it generates, it is off grade.
**Foundations first.** The shared opening; "ordered pair" defined as (term of A, matching term of B), A first because A is about to go across. Then the two tests a pair can be given: subtract (B − A) and divide (B ÷ A). A relationship is the test whose answer never changes.
**Read.** Three asks under one name: how are the terms related; what is the nth pair; what is a later term of B from the relationship. The gold word is "matching" or the ordinal ("5th," "10th"). At a glance: if B's start and B's step are both the same multiple of A's, B is that multiple of A; the nth pair is n − 1 jumps from the start.
**The example (relationship).** A starts at 2, adds 3; B starts at 8, adds 12; pairs (2, 8), (5, 20), (8, 32), (11, 44). (1) Both strips; the pairs read down each column. (2) Difference row: 6, 15, 24, 33. It changes, so "more than" is not the relationship. (3) Quotient row: 4, 4, 4, 4. (4) Why: B's start, 8, is four 2s stacked; B's jump, 12, is four 3s stacked. Start and every jump are four copies, so every term is four copies. (5) Plot the four pairs (A across, B up; axis numbers every 4 going up): the dots line up. (6) "Each term of B is 4 times the matching term of A."
Quick second case (the nth pair): A 1 add 2, B 3 add 8, 5th pair. Five positions, four arcs on each strip, counted: A lands on 9, B on 35: (9, 35). The choice (11, 43) is five jumps, (35, 9) is the swap.
Quick third case (a later term from the relationship): A starts at 2 adds 2, B is 4 times A, 10th term of B. Nine arcs on A: 20; the arrow "× 4": 80. 88 is ten jumps; 24 is "4 more"; 20 is A's term.
**Fast.** Subtract and divide the first two pairs; the test that agrees is the rule. The tenth term is nine jumps.
**Sense.** B's terms are bigger, and about four times bigger (8 against 2, 44 against 11).
**Check.** 4 × 11 = 44 on the last pair; for the 10th term, 80 ÷ 4 = 20 is A's tenth.
**Rule out.** "A is 4 times B" has A bigger, and A's row is the small one: gone. "12 more" and "4 more" are killed by the difference row changing. Pairs with the numbers swapped put B first.
**Line.** "Subtract and divide; keep the one that never changes."
**Trap.** Checking only the first pair: 8 − 2 = 6 and 8 ÷ 2 = 4 both look like rules. The second pair ends it, so the film never judges a relationship before two rows of both tests are written. And the off-by-one: the 5th pair is four jumps, not five; arcs are the only things ever counted.
**Kit.** Difference and quotient rows under paired cells, stacked copies on an arc, `link` from a pair to its dot, a plane with `ystep` 4 for the plot.
**Writer.** Strongest writer: the "why" is a motion (copies stacked under start and jump) and the three asks need the example that exposes the first-pair slip.

### `table-rule-sentence` — Say the rule in a sentence

**Flagged first.** No standard id. The act is 5.OA.B.3's "generate patterns using given rules" run backward (find the rule) with 6.EE.A.2a's words ("multiplied by," "decreased by"). `facts.ts` prints neither the table nor the sentence frame; it must, or the writer cannot see the problem.
**Foundations first.** The table with x over y; the rule arrow from an x cell to its y cell with its operation unknown, a gold "?" riding it. The four words the frame offers, each said with its sign: increased by (+), decreased by (−), multiplied by (×), divided by (÷).
**Read.** "One rule turns every x into its y; complete the sentence." Two slots: the word and the number. At a glance: if y is smaller than x, the word is "decreased" or "divided"; bigger, "increased" or "multiplied."
**The example.** x: 3, 9, 12, 30; y: 1, 3, 4, 10. Chosen so the first pair fits two rules. (1) First pair, 3 → 1: two candidate arrows drawn, "− 2" and "÷ 3." (2) Second pair, 9: along "− 2" lands on 7, not 3, so that arrow fades; along "÷ 3" lands on 3. (3) Last pair, 30 ÷ 3 = 10. (4) "y is x divided by 3."
**Fast.** First pair names two candidates; second pair picks; last pair confirms.
**Sense.** Every y is about a third of its x.
**Check.** Run the arrow backward on one pair: 4 × 3 = 12.
**Line.** "One pair suggests; the next pair decides."
**Trap.** Stopping at the first pair. For 3 → 1 half the class says "take away 2." Two arrows are drawn from the first pair every time, so the lesson's method cannot stop there.
**Kit.** Two candidate `rule` arrows on one pair, one fading on the word.
**Writer.** Cheaper model.

### `additive-multiplicative-select` — True statements about y = 5x and y = x + 6

**Flagged first.** Letters at grade 5 (6.EE.A.2); the problem defines "multiplicative" and "additive" in its own text, so the film uses those words after one plain reading.
**Standard.** 6.EE.A.2c, "evaluate expressions at specific values of their variables," and 5.OA.B.3's "relationships between corresponding terms" for the two definitional statements.
**Foundations first.** Two rule arrows side by side: "× 5" and "+ 6." Said once: 5x means 5 times x; the times sign is left out when a number sits beside a letter. A rule that multiplies is called multiplicative; one that adds, additive. Each arrow run at x = 1 and x = 2 builds a two-row table under it: 5, 10 and 7, 8.
**Read.** "Select the 2 true statements." The count goes gold: exactly two. At a glance: the two statements that name no number for x are read off the rule's shape ("y = 5x is multiplicative" is true; "in y = 5x, y is always 6 more than x" has the wrong rule's number in it). The rest each need one arrow run.
**The example.** The variant as given. (1) The two definitional statements first. (2) Each numeric statement: 4 along "+ 6" lands on 10, not 9 and not 24; 3 along "+ 6" lands on 9; 5 along "× 5" lands on 25, not 10. (3) Two true: "y = 5x is multiplicative," and "in y = x + 6, when x = 3, y = 9."
**Fast.** Shape statements by the sign in the rule; number statements by one arrow run each.
**Sense.** Along "× 5" every y is far above its x; along "+ 6" every y is just 6 above.
**Check.** Count the selections: two. Re-run the two chosen.
**Rule out.** Any statement that uses the other rule's number (24 is 4 × 6; "6 more" under 5x) dims in one beat: "wrong arrow."
**Line.** "5x is five times x."
**Trap.** 5x at x = 5 read as 5 and 5, giving 10. The arrow's label is "× 5," and 25 appears at its end on screen.
**Kit.** Two `rule` arrows with `run`, six choices dimmed as a set.
**Writer.** Cheaper model.

---

## Coordinate first quadrant (grade 5, 5.G.A.1 and 5.G.A.2)

### `first-quadrant-locate` — Which point is at (1, 3)?

**Standard.** 5.G.A.1: "the first number indicates how far to travel from the origin in the direction of one axis, and the second number indicates how far to travel in the direction of the second axis."
**Foundations first.** The shared build of the plane. Then "across, then up," done live: from the origin a blue arrow runs 1 along the x axis with its count ticking, then a rust arrow up 3 with its own count, and the destination is marked.
**Read.** "Which point is at (1, 3)?" The first number goes gold with the x axis, the second with the y axis. At a glance: 1 across is close to the y axis; 3 up is middling; the answer is a point near the left of the picture, higher than it is far.
**The example.** Letters P, Q, R, S on the app's plane; P at (1, 3), Q at (3, 1), the others nearby. (1) Across 1, the count "one." (2) Up 3, "one, two, three." (3) The path ends on P. (4) P.
**Fast.** Across first, then up; the letter under the dot.
**Sense.** P sits where a small across and a bigger up would put it.
**Check.** Drop from P to the x axis: 1; across to the y axis: 3.
**Rule out.** Q, at (3, 1), is the swap: "that is three across and one up." The others are not on the path. Dim together.
**Line.** "Across, then up. The first number always goes across."
**Trap.** Going up 1 and across 3, landing on Q. The film does the wrong order once, on purpose, and lands on Q: "the numbers are the same; the order is not."
**Kit.** `plot` with `path` on the app's plane through `scene`; `dim` on lettered points.
**Writer.** Cheaper model once `first-quadrant-coordinates` is approved; it reuses that lesson's build.

### `first-quadrant-coordinates` — The coordinates of P (pilot)

**Standard.** 5.G.A.1, the same clause, run backward: a point given, its pair asked, "with the convention that the names of the two axes and the coordinates correspond."
**Foundations first.** The plane built from two number lines, the origin, ordered pair as address. "Across, then up" done once forward for a point the film chooses. Then the backward move: a point's shadow. A dashed blue line falls straight down from the point to the x axis and the number it lands on is the first coordinate; a dashed rust line goes straight across to the y axis for the second.
**Read.** "What are the coordinates of point P?" The answer is a pair in parentheses, across first. At a glance: P is nearer the y axis than it is high, so the first number is smaller than the second.
**The example.** P at (3, 5); choices (4, 6), (6, 4), (3, 5), (5, 3). (1) The shadow drops from P; the blue line meets the x axis at 3, counted on the gaps: "one, two, three." (2) The rust line meets the y axis at 5. (3) Written as (3, 5): across first. (4) Walk it forward as proof: across 3, up 5, the path lands on P.
**Fast.** Drop to the x axis, then across to the y axis; write them in that order.
**Sense.** Small across, bigger up; P looks that way.
**Check.** Across 3, up 5 from the origin reaches P.
**Rule out.** (5, 3) is the swap: five across would be far to the right of P. (4, 6) and (6, 4) are one too many each way, from counting lines instead of gaps. Dim all three with the two reasons.
**Line.** "Across, then up. The first number always goes across."
**Trap.** Two real ones. Swapping the pair, killed by the shadow falling in the axes' colors and the forward walk. Reading 4 when P is at 3 because the count started at the first grid line: the count ticks on the gaps from the origin, and the film says it: "the line at zero is where we start, not one."
**Kit.** `shadow` to both axes with the values landing on the axes, `plot` with `path`, `dim`.
**Writer.** Strongest writer: the picture is born here and every later plane lesson points back.

### `coordinate-move` — Move right and up from A

**Standard.** 5.G.A.1, "how far to travel … in the direction of one axis," now from a point that is not the origin.
**Foundations first.** The plane; A read by its shadow, (5, 4). A move is the same travel as plotting, starting from A instead of from the origin.
**Read.** "Start at A. Move 4 right and 2 up. Where do you stop?" "Stop" goes gold: the answer is the place you end, not the move you made. At a glance: the answer's first number is more than A's first, its second more than A's second; both numbers of the move are smaller than either coordinate, so a pair made of the move numbers alone is wrong.
**The example.** A at (5, 4), move 4 right and 2 up; choices (9, 6), (4, 2), (7, 8), (6, 9). (1) The blue arrow from A along a grid line, counting "one, two, three, four," ends at x = 9. (2) The rust arrow up, "one, two," ends at y = 6. (3) The shadow of the stopping point: 9 and 6. (4) On the board: 5 + 4 = 9 across, 4 + 2 = 6 up: (9, 6).
**Fast.** Add the right move to the first number, the up move to the second.
**Sense.** Right and up both make the numbers bigger.
**Check.** From (9, 6) back to A is 4 left and 2 down: read the arrows backward.
**Rule out.** (4, 2) is the move itself, not a place: "that is how far, not where." (6, 9) is the swap. (7, 8) added the moves to the wrong numbers (5 + 2, 4 + 4). Dim together.
**Line.** "The move is how far; the stop is where."
**Trap.** Answering (4, 2), the two numbers in the sentence. The arrows are drawn from A, and the stopping point's shadow lands on 9 and 6, nowhere near 4 and 2.
**Kit.** `plot` with `path` and `from: "A"`, `shadow`.
**Writer.** Strongest writer in the first wave: "the move is not the stop" is staged, not stated; after that, a cheaper model can follow it.

### `coordinate-context-points` — Points that mean something

**Standard.** 5.G.A.2: "interpret coordinate values of points in the context of the situation," with 5.G.A.1 for the travel. A mixed type: it teaches reading the axis labels.
**Foundations first.** The plane with its axes named by the situation: "Weeks" along the x axis in blue, "Dollars saved" up the y axis in rust. The one idea true for every kind: the axis labels say which number is which. A point is a sentence with two numbers, and the labels tell you which number is the weeks and which the dollars.
**Read.** Four asks. A sentence given, which point shows it. A point given, which sentence says it. A sentence given, write the pair. Two points at the same across-value, how far apart. In every one, the first move is reading the two axis labels and putting the sentence's numbers with their axes. At a glance: the number that goes with the across-label is the first coordinate; two points straight above each other share their first number and differ only in height.
**The example (sentence to point).** "After 9 weeks, the student has saved 4 dollars." Four lettered points, C at (9, 4), another at (4, 9). (1) Read the labels: weeks across, dollars up. (2) 9 is weeks, so 9 across; 4 is dollars, so 4 up. (3) Across 9, up 4: the path lands on C. (4) Say C back as a sentence: "nine weeks across, four dollars up."
Quick case (point to sentence): rounds across, points up; the dot at (3, 1); its shadow reads 3 rounds, 1 point: "After 3 rounds, the team has 1 point." "After 1 round, 3 points" has the numbers on the wrong axes.
Quick case (sentence to pair): "After 2 weeks the plant is 6 centimeters tall," pair as (weeks, height): 2 is weeks, first; 6 is height, second: (2, 6).
Quick case (compare): both plants measured at 5 weeks; A at (5, 6), B at (5, 7). Same across, so straight above each other; the gap between the heights is drawn on the rust axis: 7 − 6 = 1 centimeter.
**Fast.** Labels first; put each number with its axis; then across, then up.
**Sense.** A point far to the right means many weeks; a high point means many dollars.
**Check.** Read the chosen point's shadow back as a sentence with its units and ask if it is the sentence given.
**Rule out.** The point at (4, 9) is the swap: "four weeks and nine dollars is a different story." In the compare case, 13 is the two heights added, 5 is the weeks, 7 is one plant's height alone; dim together.
**Line.** "The axis labels tell you which number is which."
**Trap.** Using the order the numbers appear in the sentence instead of the labels; in these items the order happens to agree, so the habit never gets caught in practice. The film puts the labels on the axes before any point is read and asks "which axis is weeks?" aloud before plotting, so the label, not the sentence order, is what the child learns to look for.
**Kit.** Axis `names` from the situation, `plot` with `path`, `shadow`, a `between` segment on the y axis for the gap.
**Writer.** Strongest writer: mixed, and the lesson lives on which example exposes the reading.

### `graph-of-paired-values` — Which graph plots every pair?

**Standard.** 5.G.A.2, "graphing points in the first quadrant," and 5.G.A.1 for the order. Choices are graphs; `facts.ts` describes them as text, but the film must draw them as four small planes.
**Foundations first.** The plane; an ordered pair as one dot; a table beside the plane with x over y. The row-to-point move: a row lights gold and its dot lights with it (or the pair slides out of the table and lands). A graph "shows the pairs" only if it has one dot for every row, each at its row's address, and no others.
**Read.** "y is 4 times x; which graph shows the pairs for x = 1, 2 and 3?" The count of pairs goes gold: three pairs, three dots. At a glance: the dots must sit at x = 1, 2 and 3, since those are the in-numbers, and their heights climb by 4 each time.
**The example.** y = 4 × x for x = 1, 2, 3. Choices: dots at (1, 4), (2, 8), (3, 12) | (4, 1), (8, 2), (12, 3) | (1, 4), (2, 8) | (1, 5), (2, 6), (3, 7). (1) Table: the arrow "× 4" run on 1, 2, 3: 4, 8, 12. Three rows, three pairs. (2) Count the dots in each small graph: one has two; gone. (3) The first number goes across: one graph's dots stand at x = 4, 8, 12; gone. (4) Row one is (1, 4): across 1, up 4; in one graph the dot above 1 is at height 5; gone. (5) The survivor: each row lights with its dot, (1, 4), (2, 8), (3, 12).
Quick second case (a table of five pairs, no rule): (4, 1), (5, 5), (6, 9), (8, 8), (10, 8). Count: five dots. The dot above 10 must be at height 8; one graph has it at 1. (8, 8) is the same either way, which is why swapping is harmless there and nowhere else.
**Fast.** Count the dots, then check the first pair's dot by across-then-up, then the last pair's.
**Sense.** Times 4 makes each dot much higher than it is far; a graph whose dots lie far to the right and low has the numbers swapped.
**Check.** Read each dot's shadow back into the table: three rows, all present, none extra.
**Rule out.** Wrong dot count, dots at the wrong across-values (the swap), a dot at the wrong height: three reasons, three graphs, dimmed as they fail.
**Line.** "One dot for every pair, at its address, and no extras."
**Trap.** The swapped graph, chosen because its dots "use the right numbers." The across check kills it: the in-numbers were 1, 2, 3, and those must be where the dots stand on the x axis.
**Kit.** Four small planes as the problem's choices, each drawn to scale from a list of pairs and dimmable; `link` row-to-point on the main plane; `rule` and `run` in the table.
**Writer.** Cheaper model once the choice-graph card exists; the method is one, and every dot is checkable by machine.
