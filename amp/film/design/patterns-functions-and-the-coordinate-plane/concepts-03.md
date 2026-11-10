# Patterns, functions and the coordinate plane: per-type concepts, part 3

Ten types across three skills: the grade-5 plane and its vocabulary, the grade-6 independent-and-dependent family, and the grade-6 four-quadrant plane. The grade-5 films say "the number that goes across" and "the number that goes up" until the problem writes x and y, then "x is the across number, y is the up number" once. Nothing is struck out at grade 5. Colors as the family design fixes them: blue for across, the first number, the independent column; rust for up, the second number, the dependent column; teal for the rule arrow; gold for the one thing being looked at.

---

## Coordinate first quadrant (grade 5)

### `line-graph-reader` — Read values, highs, lows and changes from a line graph

**Shelf:** a data-display reading type (family 32) riding on this family's plane; it stays here because the picture is the plane, but the lesson uses family 32's language: each dot is one measurement.

**Standard.** 5.G.A.2: "graphing points in the first quadrant of the coordinate plane, and interpret coordinate values of points in the context of the situation." The interpreting clause is the whole type.

**Foundations first.** What a line graph is, built in front of the learner from a list. Six hours, six amounts in a table (hour in blue over liters in rust). The vertical axis is a number line standing up: say what it counts by, since the labels go 0, 10, 20 and a point between two lines is halfway. Each row becomes a point: across to the hour, up to the amount, dot. The dots are joined by segments only so the eye can see rising and falling; nothing happened between the hours. Then say what it is for: the height of each dot is the amount at that hour, so any question about the amounts is answered by reading the heights.

**Read.** Four shapes under one name: greatest or least (which hour), closest to a value, which statement is true, greatest increase or decrease between neighbors. The question's word goes gold, and the first beat says what the answer must look like: an hour, not an amount; a pair of neighboring weeks, not one week. At a glance: the tallest dot is the greatest, the lowest is the least, the steepest downhill segment is the biggest drop.

**The example (which statement is true, since it holds every reading inside it).** Tank, 6 hours, scale by 10 from 0 to 100; amounts 50, 60, 40, 90, 80, 30. Choices: Hour 1 was 50 more than Hour 5; greatest decrease Hour 2 to 3; greater on Hour 5 than Hour 6; greater on Hour 2 than Hour 5. (1) Scale: each line is 10, said and marked. (2) Read every dot: a dashed line falls from each dot to the vertical axis in rust, the number lands; the list fills under the graph: 50, 60, 40, 90, 80, 30. (3) Test each statement on the list and the picture. Hour 1 against Hour 5: 50 is less than 80, not 50 more: dims. Hour 2 against Hour 5: 60 against 80: dims. Greatest decrease: write the change between every pair of neighbors beside its segment: +10, −20, +50, −10, −50; the biggest drop is 5 to 6, not 2 to 3: dims. Hour 5 against Hour 6: 80 against 30, the dot visibly higher: true. (4) Check on the graph: the eye confirms the dot at 5 is above the dot at 6.
Quick cases, three beats each: greatest (the tallest dot; the answer is the hour under it, Hour 4); closest to 47 on a by-5 temperature scale (read each, pick the one with the smallest gap, 45 at Day 2); greatest decrease asked alone (the steepest downhill segment, confirmed by the written drop).

**Fast.** Scale first. Write every height. From then on it is a question about six numbers; for increases and decreases, write the neighbor differences and pick the largest or the most negative.
**Sense.** Greatest is the tallest dot; a decrease is a downhill segment read left to right.
**Check.** Point at the dots the chosen statement names and see it; for a change, subtract the two heights again.
**Rule out.** Any comparison the eye settles (one dot clearly higher) is dimmed on sight; a "50 more" claim is checked against the lines between the two dots.
**Line.** "Scale first, then write down every height."
**Trap.** Answering the amount when asked the hour (90 for Hour 4), and picking the lowest week for "decreased the most": children read "decrease" as "least". The written drop beside each segment makes the biggest fall a segment, not a dot. Also counting grid lines as ones when each is 10: the scale is read and marked before anything else.
**Kit.** If the app's line-graph figure exists, use it through `scene`; otherwise `axes` with `names` and `grid`, `curve` through the dots, `shadow` to the y axis per dot, and a signed change label on each segment (the `trend` action of 4.3 carrying a number). The table of heights under the graph via `table` with `orient: "rows"`.
**Writer.** Strongest: a mixed reading type; the example must be chosen so the false statements fail for different reasons.

### `coordinate-terms-slots` — Name the parts of a coordinate plane

**Shelf.** Vocabulary-only (noted in the curriculum); the film stays short and is the plane's birth certificate that every later grade-5 lesson can point back to.

**Standard.** 5.G.A.1: "a pair of perpendicular number lines, called axes ... the intersection of the lines (the origin) arranged to coincide with the 0 on each line ... located by using an ordered pair of numbers, called its coordinates ... the names of the two axes and the coordinates correspond."

**Foundations first.** The whole lesson is the build. One number line laid flat: the x axis, in blue, 0 at the left. A second number line stood straight up through that 0: the y axis, in rust. Where they cross is the origin: zero on both lines, the place every point is measured from. A point is named by two numbers in parentheses, an ordered pair: across first, then up; those two numbers are its coordinates, and each is named for the axis it is read on: the first is the x-coordinate because it is read on the x axis, the second the y-coordinate. One point, (3, 2), plotted across then up, with both coordinates shown landing on their axes, so the words have a picture.

**Read.** Three descriptions to match to names. At a glance: a description about a line is an axis (flat is x, standing is y); about a place where lines meet is the origin; about a number in a pair is a coordinate (first is x).

**The example.** The match as the app shows it. Each description is read; the part it names lights gold on the plane (the flat axis glows, the crossing pulses, the first number of (3, 2) flashes); its name slides into the slot. Three beats of work, no more.

**Fast.** Line or point or number? Flat line x, standing line y, crossing origin, first number x-coordinate, second y-coordinate.
**Check.** Read each filled statement aloud and point at the part on the plane.
**Line.** "Across is x; up is y; the origin is where both are zero."
**Trap.** Swapping the two axes (which one goes across). The build lays the x axis flat first because the first number goes across, and the colors stay fixed for the whole grade.
**Kit.** `axes` with `names`, `grid` and `origin`; `highlight` of a whole axis as a part; a slot-matching card on the board (or `problem` plus `text` lines writing each match), which the kit lacks.
**Writer.** Cheaper model: one picture, three named parts.

### `point-on-axis-sentence` — A point with a 0 lies on an axis

**Off grade in the method, not the variants.** The app's method says "a negative number means left or down"; negatives are 6.NS. The grade-5 variants should stay on the positive axes, as (9, 0) does; the negative clause belongs to grade 6's `plot-points`.

**Standard.** 5.G.A.1: "the first number indicates how far to travel from the origin in the direction of one axis, and the second number indicates how far to travel in the direction of the second axis."

**Foundations first.** One line names the plane from `coordinate-terms-slots` (x across, y up, origin at the crossing). Then the idea: a point is two moves, across then up, and a 0 is a move of nothing. If the up-move is 0, you never leave the x axis; if the across-move is 0, you never leave the y axis. Said before any example: "a zero means no move that way, so you stay on the other axis."

**Read.** The statement has four blanks: which axis, which coordinate is 0, how many units, which direction. At a glance: the coordinate that is not zero carries all the information (how far, which way); the zero only says which axis.

**The example.** (9, 0). (1) Across 9: the blue arrow runs along the x axis, its count ticking 1 to 9 on the gaps. (2) Up 0: the rust arrow has no length; the dot drops where the blue arrow stopped, sitting on the x axis. (3) Fill the sentence: on the x-axis, because the second coordinate (the y-coordinate) is 0; 9 units; to the right of the origin. (4) Read it back: drop to the x axis, 9; across to the y axis, 0.
Quick second case, because the type holds both axes: (0, 4): across 0, nothing; up 4: the dot sits on the y axis, 4 above the origin.

**Fast.** The zero tells you which coordinate is missing; you stay on the other axis, and the nonzero number is how far along it.
**Sense.** 9 is a long way across and no way up; the dot must be on the floor line.
**Check.** Read the point back from the plane; both numbers return.
**Line.** "A zero means no move that way."
**Trap.** Matching the zero to the axis name: "(9, 0) has y zero, so it is on the y axis." The arrow picture ends it: the point traveled along the x axis and never climbed, so it is on the x axis. The sentence's blank "because its y-coordinate is 0" is filled with the dot visibly on the x axis.
**Kit.** The plotting path (`plot` with `path: true`) must draw a zero-length leg honestly: a pulse at the turn and the label "up 0" rather than an arrow. A sentence card with slots on the board.
**Writer.** Cheaper model: one picture, two cases, one motion.

---

## Dependent variables (grade 6)

### `staar-rate-equation-choice` — One unit's worth from a total, then the equation

**Standard.** 6.EE.C.9: "write an equation to express one quantity, thought of as the dependent variable, in terms of the other quantity ... e.g., ... d = 65t." The unit rate from a total is 6.RP.A.3b ("unit rate problems"), and 7.RP.A.2b in the catalog is a stretch label for the same move.

**Foundations first.** Two words, defined with the table. The independent quantity is the one you pick: minutes; it fills the left column (blue) counting up by itself. The dependent quantity follows: sheets, right column (rust). "s in terms of m" means s alone on the left of the equals sign and, on the right, what is done to m to get s. "A steady rate" means the same amount every minute, so one minute's worth, repeated, makes every row. The table starts with the one row the story gives, 300 | 75, and a gold "?" at m = 1.

**Read.** Gold on "s in terms of m" and "steady rate". The answer must look like s = (a number) m. At a glance: 75 sheets in 300 minutes is less than one sheet a minute, so the number in front of m is less than 1; two choices (75 and 300) are the totals wearing a rate's clothes.

**The example.** Printer, 75 sheets over 300 minutes; choices s = 0.25m, s = 75m, s = 4m, s = 300m. (1) Table: minutes | sheets; 300 | 75. (2) One minute's worth: 75 shared over 300 minutes is 75 ÷ 300 = 0.25; the "?" fills: 1 | 0.25. (3) Steady: every minute adds another 0.25; rows 2 | 0.50 and 4 | 1 appear (one sheet every four minutes). (4) The rule arrow from the m column to the s column, labeled × 0.25: s = 0.25m. (5) Check against the story's own row: 0.25 × 300 = 75. (6) The rows plotted on a plane named Minutes and Sheets lie on a straight line from the origin through (300, 75): the standard's "relate these to the equation", one beat.

**Fast.** Divide the dependent total by the independent total; that number goes in front of the independent letter. Then test the equation with the story's two numbers.
**Sense.** Fewer sheets than minutes means less than one sheet a minute.
**Check.** m = 300 gives 75, read aloud as a true sentence.
**Rule out.** s = 75m and s = 300m use a total as the rate: 75 sheets every minute would be 22,500 sheets in 300 minutes; dim together. s = 4m is the rate upside down, 300 ÷ 75: that is minutes per sheet, and the question wants sheets per minute; dims. In the kennel variant, f = d + 0.4 is an add rule, and adding is never a steady rate: at d = 200 it gives 200.4, not 80.
**Line.** "Divide the total you get by the total you pick: that is one unit's worth."
**Trap.** s = 75m, because 75 is the only number that looks like a rate; and dividing the wrong way. The 300 | 75 row beside the 1 | 0.25 row, and "sheets per minute puts sheets on top", together with the one-line check, make both impossible.
**Kit.** `table` with the rule arrow and `fill`; `dim`; `axes` with `names` and `link` from table rows to points for the closing beat.
**Writer.** Cheaper model: one method, named actions, the check is arithmetic.

### `independent-dependent-roles` — Which quantity do you pick?

**Standard.** 6.EE.C.9: "two quantities in a real-world problem that change in relationship to one another ... one quantity, thought of as the dependent variable, in terms of the other quantity, thought of as the independent variable." The horizontal-axis variant practices the convention the standard's d = 65t example implies.

**Foundations first.** The whole lesson is the definition, built on one table: weeks of saving | total savings, 1 | 15, 2 | 30, 3 | 45, 4 | 60. The test, said plainly: "Which number do I get to pick? Which one comes out because of it?" The weeks go by on their own and I decide how many to look at: independent, left column, blue, counting up by itself. The savings change because the weeks did, not the other way: dependent, right column, rust. The word itself: the savings depend on the weeks. The teal rule arrow runs from weeks to savings, × 15. Then the plane, axes named Weeks and Dollars saved: the one you pick goes across, because the first number of every pair is the one you chose; the one that follows goes up. Each row lights and its dot lights with it.

**Read.** Three shapes: which statement is true; which is dependent or independent; which is on the horizontal axis. Gold on the asked word. At a glance: in every story one quantity is time or a count that runs by itself (weeks, hours, tickets) or a length you set (side length); that one is independent.

**The example.** The statement variant on the savings table. Ask the test aloud; weeks is picked, savings follows. The true statement: weeks independent, savings dependent. Rule out, together with one reason each: "both are independent because both are numbers" (being a number makes nothing independent; one of them comes from the other), "the first column is always dependent because it is listed first" (order on paper proves nothing; the test is which one you pick), "savings independent, weeks dependent" (you cannot decide to have 60 dollars and have the weeks follow; the arrow points the other way).
Quick second case: the pairs graphed; side length and perimeter. You pick the side; the perimeter follows (4 times the side); side length goes across. "The one with the larger numbers" dims: size says nothing. "Either one" dims: the axes have fixed jobs.

**Fast.** Ask "which one do I pick?" That one is independent: left column, across. The other follows: dependent, right column, up.
**Sense.** Say "___ depends on ___" and hear whether it is true: "savings depend on weeks" is true; "weeks depend on savings" is not.
**Check.** The independent column counts up on its own (1, 2, 3, 4); the dependent column does not start the pattern, it answers it.
**Line.** "You pick the input; the output follows."
**Trap.** Choosing by size (the bigger numbers feel like the result) or by position (first named, first column). Both are decoys in the app and both are named as they dim; the arrow pointing from the counting column to the other is what decides.
**Kit.** `table` with column `inks` and the rule arrow; `link` to the named plane; `dim`.
**Writer.** Strongest: a concept lesson with no arithmetic, where the quality is in how the test is said and the decoys are explained.

### `dependent-variable-equation` — The equation that gives the dependent variable

**Standard.** 6.EE.C.9: "write an equation to express one quantity, thought of as the dependent variable, in terms of the other ... using graphs and tables, and relate these to the equation."

**Foundations first.** "g in terms of a": g alone on the left; the right side is what is done to a. Two kinds of rule, each shown in a three-row table with its arrow: a plus rule (always 8 more: the two columns keep a constant gap, arrow + 8) and a times rule (the same amount each: the right column is the same multiple of the left in every row, arrow × 9; the row with 1 shows the multiplier itself). The story's words tell which: "always ___ more, older, warmer" is a plus rule; "each, per, every ... the same amount" is a times rule.

**Read.** Gold on "c in terms of n" (which letter stands alone) and on the story's rule word. The answer must have the dependent letter alone on the left. At a glance: a choice with the other letter alone is gone; "same amount each" means a times rule, so the plus choice is gone.

**The example (times rule, number read from the table).** Tickets: n | c: 2 | 18, 3 | 27, 5 | 45; choices n = 9c, c = 9n, c = 18n, c = n + 9. (1) c alone on the left. (2) "Every ticket costs the same": one ticket costs c ÷ n: 18 ÷ 2 = 9, 27 ÷ 3 = 9, 45 ÷ 5 = 9; the row 1 | 9 appears. (3) Arrow × 9 from n to c: c = 9n. (4) Check a row: n = 5, 9 × 5 = 45.
Quick second case, a different kind (plus rule, constant in the story): greenhouse always 8 degrees warmer, a | g: 50 | 58, 60 | 68. "8 warmer" is add: g = a + 8 (8 × 50 would be 400 degrees). Check: 60 + 8 = 68.

**Fast.** Put the dependent letter alone. Story word: "each" or "per" means times, "always ___ more" means plus. Get the number from the row with 1, or by dividing (times) or subtracting (plus) in any row; test a second row.
**Sense.** More tickets cost more; the greenhouse is warmer than outside, so g is the bigger number.
**Check.** Substitute one table row into the chosen equation and read a true statement.
**Rule out.** The wrong letter alone (n = 9c says the ticket count is nine times the cost; a = g + 8 says the outside is warmer): dim. The plus choice in a "same amount each" story fails the first row tested (3 + 9 is 12, not 27): dim. c = 18n uses the cost of two tickets as the cost of one: dim. g = a − 8 makes the greenhouse colder: dim.
**Line.** "The letter that follows stands alone."
**Trap.** a = g + 8: the shape looks right and the number is right; only the letters are swapped. The arrow always points from the picked quantity to the following one, and the equation is read along it: "g is a with 8 added."
**Kit.** `table` with rule arrow and `fill`; `dim`.
**Writer.** Cheaper model: two named cases, each a table and an arrow.

### `dependent-variable-value` — Use the equation forward or backward

**Standard.** 6.EE.B.7: "equations of the form x + p = q and px = q" (the backward cases); 6.EE.A.2c: "Evaluate expressions at specific values of their variables" (the forward case). Both in service of 6.EE.C.9's equations.

**Foundations first.** The equation c = 8n drawn as its table (n | c: 1 | 8, 2 | 16, 3 | 24, …) with the teal arrow × 8 from n to c. Forward: put a number in n and run the arrow. Backward: the arrow turned around and relabeled ÷ 8, undo, from family 11, named in one line. Which letter the given number belongs to is decided by its unit: dollars is a cost, so it is c; tickets is n. That is the habit the whole type rests on.

**Read.** Gold on the given number with its unit and on the asked unit. At a glance: if the asked letter is the one alone on the left, it is forward (compute); if not, backward (undo). 8 × 10 = 80, so the ticket answer is about ten before any work.

**The example (backward, the harder case).** "Each ticket costs 8 dollars, so c = 8n. How many tickets cost 80 dollars?" (1) 80 dollars is a cost: it goes in c's place: 80 = 8n, the 80 landing in the c column of the table beside a gold "?" in the n column. (2) n is multiplied by 8, so divide both sides by 8: n = 10; the arrow reverses, ÷ 8, and 80 slides back to 10. (3) Sense: ten tickets at 8 dollars. (4) Check forward: 8 × 10 = 80.
Quick second case (forward): p = 18h, 7 hours: 7 is hours, so h = 7; p = 18 × 7 = 126; run the arrow. Three beats.
Quick third case (backward with a plus rule, because the standard names both forms): m = b + 8, Student D is 12: 12 = b + 8; subtract 8: b = 4; sense: the brother is younger; check 4 + 8 = 12.

**Fast.** Match the given number to its letter by the unit. If the unknown letter is alone, compute. If not, undo: divide if it is multiplied, subtract if something is added.
**Sense.** Tickets times 8 should make about 80; a brother is younger than Student D.
**Check.** Put the answer back and run the equation forward to the given number.
**Line.** "Match the number to its letter by its unit, then run the arrow or undo it."
**Trap.** The given number put in the first letter seen: 80 in n's place, c = 8 × 80 = 640 tickets. The unit decides: 80 dollars is a cost, and the number lands in the column whose header says dollars. The sense check (640 tickets for 80 dollars) would have caught it too, and the film says so.
**Kit.** `table` with `rule`, `run` and `reverse`; the board.
**Writer.** Cheaper model: one method, two directions, every step checkable.

### `table-equation-slots` — Multiplier and constant from a table

**Off grade.** Finding both the multiplier and the added constant from a table is rate of change and initial value, 8.F.B.4; 6.EE.C.9's own example is the one-step d = 65t. Teach it anyway, in grade-6 words, as "times, then add".

**Standard.** 6.EE.C.9 as filed ("Analyze the relationship between the dependent and independent variables using ... tables, and relate these to the equation"); the skill practiced is 8.F.B.4's "Determine the rate of change and initial value of the function from ... a table".

**Foundations first.** x is the number that goes in, y the number that comes out. A times rule makes a table whose y climbs by the same amount every step (y = 3x: 3, 6, 9, 12, steps of 3). A rule that times and then adds makes the same steps but starts somewhere else. So the steps tell the multiplier, and what is left over tells the constant. The strip picture from grade 4 is named: the arcs between neighbors in the y row carry the step.

**Read.** "Complete the equation" y = □ x □ □: a multiplier, a sign, a constant. At a glance: if y's steps are bigger than x's, the multiplier is more than 1; if the first y is more than multiplier × first x, the sign is plus.

**The example.** x: 1, 2, 3, 4; y: 7, 10, 13, 16. (1) Arcs over the y row: +3, +3, +3; equal steps, 3 for every step of 1 in x: the multiplier is 3. (2) A muted row "3x" slides in between: 3, 6, 9, 12. Compare it with y: 7, 10, 13, 16: each is 4 more. The constant is +4. (3) y = 3x + 4, the slots filling on the words. (4) Check a row not yet used: x = 4: 12 + 4 = 16.
Quick second case, because the app's own method names it: x climbs by 2 (x: 2, 4, 6, 8; y: 5, 11, 17, 23). Steps of 6 in y cover two steps of x, so 3 per step of 1; 3x row: 6, 12, 18, 24; y is 1 less each time: y = 3x − 1. Shows the divide and the subtract.

**Fast.** Multiplier = y's step ÷ x's step. Constant = first y − multiplier × first x; its sign is the operation. Test another row.
**Sense.** The equation's row for x = 1 should sit where the table says.
**Check.** A row the work did not use.
**Line.** "The steps give the multiplier; what is left over is the constant."
**Trap.** Taking the first y as the multiplier (y = 7x), and keeping the raw y-step when x climbs by 2 (y = 6x). The arcs on both rows, and the "3x" row drawn between, make the multiplier a step per one, never a value.
**Kit.** `table` with `diff: true` arcs on a row and an inserted comparison row (a `fill`-able muted row); a slots card on the board.
**Writer.** Cheaper model: one method with a fixed path.

---

## Coordinate four quadrants (grade 6)

### `plot-points` — Plot in four quadrants; reflect over an axis

**Standard.** 6.NS.C.6c: "find and position pairs of integers ... on a coordinate plane"; 6.NS.C.6b: "when two ordered pairs differ only by signs, the locations of the points are related by reflections across one or both axes." 6.NS.C.8 only loosely (no distance is asked).

**Foundations first.** The grade-5 plane, extended: each axis is a number line, and number lines run both ways from zero (family 3, one line: the sign says which side). Left of the y axis is negative x; below the x axis is negative y. Across, then up, exactly as before; a negative first number is across to the left, a negative second number is down. The four quadrants named once, I to IV counterclockwise, and the sign pattern of each shown with a point in it. A 0 still means no move (from grade 5), so (−4, 0) is on the x axis.

**Read.** Three shapes: plot named pairs; plot from a description (left, below, on an axis); plot the two reflections of a point. Gold on the sign words ("left", "below") or on "across the x-axis". At a glance: the quadrant from the signs before any counting; a reflection stays the same distance from the mirror.

**The example (reflections, the case only the picture explains).** K(−3, −6). (1) Plot K: across 3 to the left, down 6; quadrant III. (2) Reflect across the x axis: the x axis is the mirror; K flips over it, leaving a ghost, landing 6 above the axis, still 3 to the left: (−3, 6). The 6 flashed from negative to positive; the −3 did not move. (3) Reflect K across the y axis: 3 to the right, still 6 down: (3, −6); now the first number flipped sign. (4) Said once, with the picture: the y-coordinate measures distance from the x axis, so flipping over the x axis changes y; the x-coordinate measures distance from the y axis, so flipping over the y axis changes x.
Quick second case (a description): "P is 3 units left of the y axis and 5 units below the x axis": left is a negative first number, below a negative second: (−3, −5), plotted across then down. "Q lies on the y axis, 2 above the x axis": across 0, up 2: (0, 2).
Quick third case: C(−4, 0) across 4 left, up nothing: on the x axis.

**Fast.** First number across (sign is the side), second number up or down. For a reflection: over the x axis, change the sign of y; over the y axis, change the sign of x; the other number stays.
**Sense.** The point lands in the quadrant its signs promised; a reflection is exactly as far from the mirror as the original, on the other side.
**Check.** Read each plotted point back: drop to the x axis, across to the y axis.
**Line.** "Flip over an axis, and the number that measures distance from that axis changes sign."
**Trap.** Flipping the wrong coordinate: "across the x-axis, so x changes." Real and common. The mirror motion kills it: flipping over the x axis moves the point up or down, visibly, so the up-down number is the one that changed. Also writing "3 units left" as +3: the across arrow runs left on the word.
**Kit.** `axes` with `quadrants: true` and `grid`; `plot` path with negative legs; `mirror` with the ghost and the flashed coordinate; the app's own plane through `scene` where it is the problem's figure.
**Writer.** Strongest: the insight is the mirror motion and the one sentence that explains which coordinate changes.

### `coordinate-point-reading` — Read one coordinate of a point

**Standard.** 6.NS.C.6c: "find and position pairs of integers ... on a coordinate plane"; 6.NS.C.6b for the signs.

**Foundations first.** The shadow, defined once: the x-coordinate is how far across the point is from the y axis (right positive, left negative); the y-coordinate is how far up or down it is from the x axis (up positive, down negative). Drop a dashed line straight down from the point to the x axis to read x; straight across to the y axis to read y. Each grid gap is one unit; count gaps, not lines, starting from the axis.

**Read.** Gold on "x-coordinate" or "y-coordinate": only one number is asked. At a glance: the sign from which side of the axis the point sits.

**The example.** P at (−2, 3), chosen so the two coordinates differ. "What is the x-coordinate of P?" (1) x is the across number: a blue dashed line falls from P straight down to the x axis. (2) Count the gaps from the y axis: 1, 2, ticking on each gap; the foot is left of the y axis, so −2. (3) Answer −2. Quick second case on the same point, the other variant: "What is the y-coordinate?" A rust dashed line runs across to the y axis; 3 gaps up: 3. Both reads together show the pair (−2, 3).

**Fast.** Drop to the axis the question names; count the gaps; left or down is negative.
**Sense.** P is left of the y axis, so its x is negative; above the x axis, so its y is positive: quadrant II.
**Check.** Read the other coordinate too and name the quadrant from the pair of signs.
**Line.** "Drop to the axis you were asked about, and count the gaps."
**Trap.** Counting grid lines instead of gaps (reading 3 for a point 2 across), and giving the other coordinate (3 when x was asked). The count ticks on gaps from the axis, and the dashed line runs to the axis the question named, in that axis's color.
**Kit.** `shadow` with a gap count that ticks; `axes` with `grid`.
**Writer.** Cheaper model: one picture, one motion, two reads.
