# Family 13, part 5: ten Algebra 1 types (functions, piecewise, sequences)

All ten stand on the same opening: **f(x) is the name of the output at input x.** Draw it once per lesson as the rule arrow from the family design, labeled f, with the input going in and the output coming out ("f of three means put three in"); it is grade 3's "× 7" arrow with a letter on it. Each lesson below says that in one short "why" shot and then does its own work. Two types are flagged as badly conceived (`piecewise-reading`, `series-recursion`); they are designed as mixed lessons that teach reading until the app splits them.

---

## Function domain range (`function-domain-range`)

**`graph-is-function` — Which graph is a function?** Multiple choice; the choices are graphs.

Note first: `facts.ts` prints the choices as prose ("a circle with center (−1, 1) and radius 2"). Confirm the app draws the four graphs. The film draws them either way, to scale on four small unit grids in one card, each with its description under it; seeing "opening to the right" fail the test is the lesson.

Standard: HSF.IF.A.1, "assigns to each element of the domain exactly one element of the range"; 8.F.A.1, "a rule that assigns to each input exactly one output. The graph of a function is the set of ordered pairs consisting of an input and the corresponding output."
Foundations first: define function in plain words (one input, one output; outputs may repeat, inputs may not have two). Then say what a graph is: every point is (input, output), so an input is a place on the x axis, and the points straight above or below that place are its outputs. A vertical line at x = a *is* the input a; wherever it touches the graph is an output of a. One touch: fine. Two touches: one input with two outputs, not a function. That is the whole test, derived, not announced.
Read: "represents a function" goes gold. The answer is a picture, so the answer must look like: a graph you could draw left to right without ever going back or straight up. At a glance: round shapes, sideways shapes and vertical lines are out; "opening to the right" is the giveaway phrase.
Example: the four graphs: circle center (−1, 1) radius 2; rays meeting at (−1, 0) opening right; the vertical line x = −2; parabola vertex (−2, 1) opening down. (1) The gold vertical test line sweeps the circle and stops at x = −1: it touches (−1, 3) and (−1, −1); both pulse. One input, two outputs: out. (2) Sweep the sideways V; at x = 1 it touches (1, 2) and (1, −2): out. (3) The vertical line: the test line lies on top of it, every point lit: one input, every output; the worst failure there is. (4) Sweep the parabola from x = −5 to 1: one touch at every position. A beat on the parabola's two points at height 0, (−3, 0) and (−1, 0): two inputs sharing an output is allowed; the test line is vertical, never horizontal. The parabola.
Fast: hold a pencil upright and slide it across; any double touch, that graph is out.
Sense: the one graph left is the only one you can trace left to right without doubling back.
Check: the sweep over the chosen graph once more; nothing lights twice.
Rule out: circle, sideways V and vertical line dim together: "each of these has an input with two outputs."
Line: "One input, one output. Two points stacked straight up, and it is not a function."
Trap: two real ones. "The parabola repeats heights, so it fails": the test line is vertical, and the lesson says outputs may repeat while the two points at height 0 are on screen. "A vertical line is a line, and lines are functions": x = −2 is drawn and the test line lands on it.
Kit: a card of four small graphs as choices (new: figure choices), `vline` with `sweep ... hits`, `dim` on figure choices.
Writer: a capable cheaper model; the sweep is a named action and the concept fixes the order of the four graphs.

---

## Function evaluation (`function-evaluation`)

**`function-evaluation` — f(a) for a quadratic rule.**

Standard: HSF.IF.A.2, "evaluate functions for inputs in their domains."
Foundations first: the arrow named f; f(−4) is "f of negative four", the output when −4 goes in, never "f times". Then one line taken from family 12: powers first, then products, then sums; a substituted negative goes in parentheses so its sign is not lost.
Read: the input is the number inside f( ); every x in the rule is replaced by it. At a glance, with a squared term and a negative input, the squared term is positive no matter what: 5 × 16 = 80, so the answer is near 80.
Example: f(x) = 5x² + x + 1, f(−4). (1) The rule rewritten with empty gold parentheses where each x was: 5( )² + ( ) + 1. (2) −4 drops into both: 5(−4)² + (−4) + 1. (3) Powers: (−4)² = 16, written as (−4)(−4), negative times negative. (4) 5 × 16 = 80. (5) 80 − 4 + 1 = 77. The chain beside the board: −4 → f → 77.
Fast: empty the x slots, fill every slot with the input in parentheses, then powers, products, sums.
Sense: the squared term alone is 80; the rest moves it by a few.
Check: f(4) = 80 + 4 + 1 = 85 in one line beside it: the two differ only in the middle term, because the square killed the sign of the first one.
Line: "Every x becomes the input, in parentheses."
Trap: 5x² at −4 as −80 (the minus survives the square: −4² read instead of (−4)²), giving −83; or the input written as 4 in the linear term, giving 85. The parentheses written before the number arrives kill the first; the gold slots filled together kill the second.
Kit: none beyond the board and the small `chain`.
Writer: cheaper; one method, one case that matters, all of it checkable by the board math check.

**`sat-entry-fn-linear-notation` — Forward, backward, and the missing constant.** Pilot lesson 4. Three cases, because they are three different acts on one arrow.

Standard: HSF.IF.A.2, "Use function notation, evaluate functions ... and interpret statements that use function notation in terms of a context"; HSA.REI.B.3, "Solve linear equations ... in one variable, including equations with coefficients represented by letters" (the constant case).
Foundations first: the arrow named C from hours to dollars, drawn as the chain h → × 5 → + 24 → C(h): the rule read as what is done to the input, in order. "C of nine" is the charge for nine hours. Then the interpret clause the app never asks: C(9) = 69 means "nine hours costs sixty-nine dollars", said with the chain filled. Backward is the arrows turned around: C(h) = 251 asks "which hour count comes out as 251?", and the undo runs the arrows in reverse order (family 11, one line).
Read: which word is given, the input or the output? "C(9)" gives the input (forward); "for how many hours is the total cost 251" gives the output (backward); "p(0) = −8" gives both, and the hole is in the rule. The answer's shape: dollars, or hours, or the number that fills the hole.
Example A (forward): C(h) = 24 + 5h, C(9). Nine enters the chain: × 5 gives 45, + 24 gives 69; the board writes C(9) = 24 + 5(9) = 24 + 45 = 69. Nine hours costs 69 dollars.
Example B (backward): C(h) = 65 + 6h, total 251. (1) 251 sits in the output box; the arrows reverse. (2) Undo the last step first: 251 − 65 = 186. (3) Undo × 6: 186 ÷ 6 = 31 hours. The board as an equation: 65 + 6h = 251, −65 both sides, ÷6 both sides.
Quick case (same method, a different look): p(x) = −6(x − 2) = −36: the chain is − 2 then × (−6); undo × (−6) first: x − 2 = 6; x = 8. Three beats; dividing by the negative is said aloud.
Example C (the hole): p(x) = 2x + c, p(0) = −8. Both ends known: 0 goes in, −8 comes out; the only unknown is on the arrow. 2(0) + c = −8, so c = −8. One beat: at input 0 the x term vanishes, so c is the output at zero.
Fast: input given, run the chain forward; output given, undo the last step first; both given, fill both and solve for the hole.
Sense: nine hours at five dollars is about 45 plus a fee, near 70. For B: 251 − 65 is about 186, and 6 × 30 = 180, so about 31 hours.
Check: C(31) = 65 + 186 = 251; the found c put back gives p(0) = −8.
Line: "f of nine means put nine in. Given the answer, run the arrows backward."
Trap: putting 251 in as the input (65 + 6 × 251): the gold on "total cost" and the answer's unit, hours. Undoing in the wrong order (251 ÷ 6 first): the reversed chain shows the last arrow undone first. Reading C(9) as C times 9: the arrow named C with 9 inside it.
Kit: `chain` with `run` and `reverse`; a chain label with a hole (c) that fills.
Writer: strongest for the pilot (it ties grade 3's arrow to notation and teaches which direction the problem runs); after the pilot lands, a cheaper model can write its siblings from this concept.

**`radical-function-value` — Evaluate a rule with a square root.**

Standard: HSF.IF.A.2, "evaluate functions for inputs in their domains."
Foundations first: the root sign is a roof: everything under it is one parcel, finished first, exactly as parentheses would be. √49 asks "what number times itself is 49?": 7. Then the number in front multiplies the root, and the number at the end is added or taken away. The chain shows the order: 41 → + 8 → 49 → √ → 7 → × 4 → 28 → − 2 → 26.
Read: the input replaces x under the roof. At a glance: in these problems the parcel always comes out a perfect square (49, 1, 0); if it does not, look for the slip.
Example: f(x) = 4√(x + 8) − 2, f(41). (1) 41 drops under the roof: 4√(41 + 8) − 2. (2) The parcel: 41 + 8 = 49, the roof now over 49. (3) √49 = 7, because 7 × 7 = 49. (4) 4 × 7 = 28. (5) 28 − 2 = 26. Each step fills its box in the chain as the board writes it.
Quick case: f(x) = 3√(x + 9) + 5 at −8. A negative input is fine once the parcel is finished: −8 + 9 = 1; √1 = 1; 3 + 5 = 8. One beat on √(x − 3) at x = 3: the parcel is 0, √0 = 0, and the answer is the outside number alone, 2.
Fast: parcel, root, multiply, add.
Sense: 4 × 7 is 28; a little less than that.
Check: put 26 back: 26 + 2 = 28, 28 ÷ 4 = 7, 7 × 7 = 49, 49 − 8 = 41. The chain run backward.
Line: "Finish under the roof first."
Trap: taking the root before finishing the inside (√41 + 8 − 5), or pulling the 4 under the roof (√(4 × 49)). The roof drawn over the whole parcel, and the chain's first arrow is + 8, not √.
Kit: `chain` with four arrows; a root drawn as a roof that widens over its parcel on the board (TeX does this; verify the highlight can cover only the radicand).
Writer: cheaper; a fixed path with the trap already in the picture.

---

## Piecewise functions (`piecewise-functions`)

**`graph-absolute-value-points` — Place the vertex and two points of a V.** The learner places points on the app's plane; any true points are accepted.

Standard: HSF.IF.C.7b, "Graph square root, cube root, and piecewise-defined functions, including step functions and absolute value functions," by hand in simple cases.
Foundations first: |x − h| is the distance from x to h on the number line (family 3, one line), and a distance is never negative, so it is the same two steps to the left as to the right. In y = a|x − h| + k: at x = h the distance is 0 and y = k: the corner, called the vertex. Step d away on either side, the distance is d both times, so both points have the same height a·d + k: the V is symmetric about x = h. a negative: the arms go down. a a fraction: pick d equal to its denominator so the height is whole.
Read: "placing its vertex and 2 more points": the vertex first, then one point each side. At a glance: the sign of a says whether the two points sit above or below the vertex; h is the number that makes the inside zero, so x − 2 means h = 2.
Example: y = −½|x − 2| + 2. (1) Inside zero: x = 2; y = 2: the vertex (2, 2) drops onto the app's plane. (2) A blue arrow along the grid from x = 2 to x = 4, labeled "2 away"; the distance is 2, so y = −½ × 2 + 2 = 1: the point (4, 1). (3) The same arrow mirrored to x = 0: distance 2 again, y = 1: (0, 1). (4) The V drawn through the three points, opening down as the minus promised.
Quick case: y = ½|x + 5| − 5: x + 5 is x − (−5), so h = −5 and the vertex is (−5, −5); two steps each way, x = −3 and x = −7, height ½ × 2 − 5 = −4. Three beats; the trap lives here.
Fast: vertex from "inside zero, y = k"; step d = the denominator of a (or 1); height a·d + k both sides.
Sense: a negative, the points are below the vertex; a positive, above; the two side points are at the same height.
Check: substitute one point: −½|0 − 2| + 2 = −1 + 2 = 1. True, so (0, 1) is on the graph.
Line: "The bars measure distance, so the same step left or right gives the same height."
Trap: the vertex at (−2, 2) for x − 2, or at (5, −5) for x + 5: the inside is set to zero on the board, not read off. The left point computed as −½(−2) + 2 = 3, the bars forgotten: the arrow's label is a length, 2, never −2.
Kit: the app's plane through `scene` with the placed dots; a distance arrow along x from h with a length label; `mirror` over the vertical line x = h; `plot` of the absolute value.
Writer: cheaper; the method is one and the picture is two named motions.

**`piecewise-evaluate` — Which piece, then the output.** Three looks: a rule with the input at a boundary, a graph with dots, and a story.

Standard: HSF.IF.A.2, "evaluate functions for inputs in their domains"; HSF.IF.C.7b (piecewise graphs) for the graph case.
Foundations first: a piecewise function is one function with several rules, each in charge of its own stretch of the x axis. The stretches never overlap, so every input belongs to exactly one piece: still one in, one out. Draw the x axis with the stretches as bands in the definition's order: x ≤ −3 ends at −3 with a filled dot (−3 is in); −3 < x ≤ 1 starts with a hollow dot at −3 (starts just past it) and ends filled at 1; x > 1 starts hollow at 1. Say it plainly: filled means that number is in; hollow means the piece stops just short of it.
Read: the input is the number in f( ). At a glance: the input lands in exactly one band; if it lands on a boundary number, the filled dot says which piece owns it.
Example A: f(x) = {−x − 3 for x ≤ −3; −2x + 5 for −3 < x ≤ 1; 2x − 3 for x > 1}, f(1). (1) The three bands drawn under the definition. (2) 1 drops onto the axis and lands on the filled dot of the middle band; the band and its rule go gold. (3) The third band starts hollow at 1: 1 is not in it. (4) −2(1) + 5 = 3. One beat: 2(1) − 3 = −1 is what the wrong piece gives; the hollow dot is why it is wrong.
Example B (a different act, reading): the graph of f, f(−3). The gold vertical line at x = −3 meets a filled dot at height −2 and an open circle on the other piece. The filled dot is the output: −2. The open circle is the other piece stopping just short.
Quick case (the story): C(g) = 7 for 0 < g ≤ 5; 7 + 4(g − 5) for g > 5; 8 gigabytes. 8 > 5, the second piece: 7 + 4(3) = 19 dollars. Said in story words: 7 dollars covers the first 5, then 4 dollars for each of the 3 extra.
Fast: drop the input on the axis, find its band (filled means in), use that rule only.
Sense: the output is the height of the graph at that x; the story's bill for 8 gigabytes is more than the 7-dollar base.
Check: the input fails the other conditions (1 is not > 1; 1 is not ≤ −3).
Line: "Find the piece first. Filled dot means that number is in."
Trap: the boundary input put into the wrong piece (1 into 2x − 3); every piece used and three outputs produced; the open circle read on the graph. The bands with their dots, and the drop that lands on exactly one.
Kit: `interval` parts with filled and hollow ends under a definition; a drop of the input onto the axis lighting its band; `plot` with `pieces`; `problem` must set `\begin{cases}` cleanly in the card.
Writer: cheaper; one method, the boundary case fixed by the concept.

**`piecewise-reading` — Three unrelated questions under one name.**

Badly conceived, as the family design says: this type holds (A) counting solutions of f(x) = c from a graph (HSA.REI.D.11), (B) the rule of one straight piece from a graph (8.F.B.4), and (C) rewriting a|x − h| + k as two lines (HSF.IF.C.7b more than HSA.SSE.A.2). The catalog's HSF.LE.A.2 fits only B. Split it; until then the lesson is mixed and teaches reading: a short "why" shot before each kind, one example each, no shared recipe recited.

Standard: HSA.REI.D.11 ("the x-coordinates of the points where the graphs ... intersect are the solutions") for A; 8.F.B.4 ("Determine the rate of change and initial value ... from two (x, y) values ... from a graph") for B; HSF.IF.C.7b for C.
Foundations first: the one idea true for all three: a piecewise graph is several ordinary pieces, and every question is about one piece or one height at a time.
Read: which kind? "How many solutions" with a dashed line: count meetings. "Which rule gives f(x) for x < −1": one piece, two of its points. "Which expression equals f(x) for x ≥ 4": the arm of a V on one side.
Kind A: f(x) = −3 on a graph with the dashed line y = −3; choices none, one, two, three. Why: f(x) = −3 asks which inputs have height −3; the dashed line is "height −3", so solutions are where the graph meets it, and the answer is a count of meetings, not an x. Here the graph never comes down to −3: none. A beat: a vertex sitting exactly on the line is one meeting; crossing it is two. Rule out: nothing, the count is the whole work. Trap: calling the dashed horizontal line a "function test": it is a height, said plainly.
Kind B: the piece for x < −1 is a line through (−1, 0) and (−3, 2); choices −x, −x − 1, x − 1, x + 3. Why: a straight piece is part of a whole line; its rule is that line's rule, even where the piece is not drawn. (1) Two points of the piece read; slope triangle: run 2 left, rise 2 up, slope −1. (2) Extend the line dashed to x = 0: one step right of (−1, 0) and one down: it would cross at −1. (3) y = −x − 1. Check: (−3, 2): −(−3) − 1 = 2. Rule out: substitute one point of the piece into every choice; (−3, 2) kills −x (3), x − 1 (−4), x + 3 (0) in one beat. Trap: reading the intercept where the *piece* ends instead of where the whole line would cross x = 0.
Kind C: f(x) = −3|x − 3|, for x < 3; choices −3x − 9, −3x + 9, 3x + 9, 3x − 9. Why: for x < 3 the inside x − 3 is negative, and the bars turn a negative around: |x − 3| = −(x − 3) = 3 − x. For x ≥ 3 the bars do nothing. The V drawn, vertex (3, 0), opening down; each arm is a line, extended dashed. (1) Left arm: −3(3 − x) = −9 + 3x = 3x − 9. (2) The right arm, for the sibling variant, in one beat: −3(x − 3) = −3x + 9. Rule out: every arm passes through the vertex, so at x = 3 the right expression must give 0: −3(3) − 9 = −18 and 3(3) + 9 = 18 dim; the left arm rises to the right, so its slope is positive: −3x + 9 dims. Check: x = 1: f(1) = −3|−2| = −6; 3(1) − 9 = −6. Trap: the same expression on both sides (the bars forgotten on the left), or a sign dropped in −3 × −(x − 3). The two arms visibly have opposite slopes.
Fast (per kind): count the meetings; two points to slope, extend to x = 0; put x = h into each choice (must give k) and match the arm's slope sign.
Line: "A piecewise graph is ordinary pieces. Look at one piece at a time."
Kit: `hline` dashed with crossing dots that count; `slopetri` on a piece with the line extended dashed past the piece; `plot` of a V with each arm's line as a muted extension.
Writer: strongest; three kinds with no shared recipe, and the "why" of each is a small picture a weak author would describe instead of draw.

---

## Arithmetic sequences (`arithmetic-sequences`)

**`arithmetic-term` — Term n from the first term and the common difference.**

Note: the app generates a single variant (−5, d = 3, term 4). The lesson teaches the general n anyway; the app should vary n and d.
Standard: HSF.BF.A.2, "Write arithmetic ... sequences ... with an explicit formula"; HSF.IF.A.3 in spirit (positions as inputs).
Foundations first: the strip from grade 4, now with letters: positions 1, 2, 3, 4 in blue, terms in rust, an arc between neighbors labeled +3. Define arithmetic sequence (the same amount added every step), common difference d (the arc's label), a₁ (the start). Term n is reached after n − 1 arcs: a_n = a₁ + (n − 1)d is a count of arcs written down.
Read: "term 4, with the first term labeled 1": three arcs. At a glance: d is positive, so term 4 is bigger than −5; three jumps of 3 is 9 up.
Example: a₁ = −5, d = 3, term 4. (1) −5 under position 1. (2) Arcs drawn on the counting words: one, two, three; under them −2, 1, 4, each term written as the arc lands; below the strip a number line hops −5 → −2 → 1 → 4, crossing zero. (3) The formula beside it: −5 + 3 × 3 = 4; the 3 × 3 is "three jumps of three".
Fast: a₁ + (n − 1)d, with n − 1 computed first.
Sense: 9 up from −5 lands at 4.
Check: count the arcs again, −2, 1, 4.
Line: "Term four is three jumps."
Trap: four jumps (7), the grade-4 off-by-one carried into letters; and a sign slip crossing zero (−5 + 9 as −14 or −4). The arcs are the only things counted, and the number line hops cross zero on screen.
Kit: table arcs; `numberline` hops. Both specified.
Writer: cheaper; the smallest lesson in the family.

**`arithmetic-sequence-as-function` — A sequence is a function of the position.** Four wordings, one picture.

Note: a(4.5) is the undefined choice every time; vary it (0, −3, 2.5) or the item is one memorized answer.
Standard: HSF.IF.A.3, "Recognize that sequences are functions ... whose domain is a subset of the integers"; HSF.IF.B.5, "Relate the domain of a function to its graph and ... to the quantitative relationship it describes"; HSF.IF.A.2 for a(k).
Foundations first: a(n) names the term at position n: "a of four" is the fourth term, the rule arrow with a position going in. Build the strip for one rule, then slide each (position, term) pair out onto the plane as a dot (row to point). The dots fall on a line, and the lesson says the whole point once: there is nothing between them, because there is no four-and-a-halfth term. The inputs are the positions, 1, 2, 3, …; that set is the domain. A muted dashed line through the dots shows what "a continuous line" would claim, and why it is wrong: it would promise a term at 2.5.
Read: four questions about this one picture: which expression is undefined (the non-position); the value a(4) (put 4 in, with n − 1 first); which description of the graph (separate points on a line); which set is the domain (the positions, not the terms).
Example: a(n) = 8 − 4(n − 1). (1) a(1): n − 1 = 0, so a(1) = 8; a(2) = 4; a(3) = 0; a(4) = 8 − 4 × 3 = −4; the strip fills. (2) Pairs slide out: (1, 8), (2, 4), (3, 0), (4, −4): four dots stepping down a line. (3) The dashed ghost line appears and is dismissed: no dot at 2.5. Then each question on its own screen, with its choices, answered from the picture in a few beats: a(4) = −4; the graph is separate points on one line with nothing between; the domain is the positive integers; a(4.5) is undefined because 4.5 is not a position.
Fast: for a value, n − 1 first, then the rest; for anything about the domain or graph, "positions only".
Sense: a(4) is three jumps of −4 below 8.
Check: the four dots are each one step over and 4 down from the last.
Rule out: the domain's decoys are either outputs (−4, −2, 0, …: those are terms, the rust column) or sets with numbers between positions ("all real numbers n ≥ 1"): dim together, "positions only, whole numbers only". The graph's decoys all have something between the dots.
Line: "A sequence only has terms at whole positions."
Trap: a(1) = 4 (n − 1 skipped): the strip's first cell is a(1) = 8 with 0 arcs. "a(4.5) = −6, so it exists": you can push 4.5 through the arithmetic, but the rule is declared for n = 1, 2, 3, …, which the problem itself says; gold on that clause. Choosing the ray or line because the dots line up: the ghost line and the missing 2.5.
Kit: `link` with `slide` from the strip to the plane; a muted dashed line through the dots.
Writer: cheaper; one build, then four reading questions whose answers the concept fixes.

**`series-recursion` — Four problems under one name.**

Badly conceived, as the family design says. The type holds (1) a term from two table rows (HSF.LE.A.2, "two input-output pairs (include reading these from a table)"), (2) explicit to recursive (HSF.BF.A.2, "translate between the two forms"), (3) a term of a non-arithmetic step rule (HSF.IF.A.3, "sometimes defined recursively"), and (4) sums of arithmetic series in three dresses (story, Σ, listed terms), which no standard in this skill covers and which are not Common Core at all (HSA.SSE.B.4 is geometric). Split into three types and move the sums to family 16's `sequence-sums`. Until then: a mixed lesson, a short "why" before each kind, one example each; the sum method shown fully once and read in its other two dresses in a beat each.

Foundations first: the strip (positions, terms, arcs) from `arithmetic-term`, and the ladder: a recursive rule says how to climb from one rung to the next, so you stand on each rung in turn.
Read: which kind? A table with two rows and "what is a₁₂"; "which recursive definition"; "a₁ = 3 and a_{n+1} = …, what is a₅"; "how many seats in the theater" or Σ or "sum of the first 12 terms".

Kind 1, table to term (the facts output does not print the table; the writer takes the seed's rows; the illustration below produces the seed's answer): rows n = 3, 22 and n = 6, 1. Why: the rows are two points of the strip; the arcs between them are all the same size. (1) From position 3 to 6 is three arcs; the terms fell 21; each arc is −7. (2) From position 6 to 12 is six more arcs: 1 + 6 × (−7) = −41. Rule out: −34 is one arc short (a₁₁). Trap: d taken as the whole drop, 21, or counting 12 arcs from the known row; the arcs are counted on the strip, from the row you stand on.
Kind 2, explicit to recursive: a_n = 8n + 1. Why: a recursive rule needs the first term and the step. (1) a₁ = 8(1) + 1 = 9 on the strip; a₂ = 17; the arc is +8. (2) a₁ = 9, a_{n+1} = a_n + 8. Rule out: a₁ = 8 dims (the 8 is the step, not the start: "a₁ is the first term, 9"); 8a_n dims (that multiplies). Check: the chosen rule climbs 9, 17, 25, and the explicit rule gives 25 at n = 3. Trap: the coefficient read as the first term; a(1) is always computed first, on the strip.
Kind 3, the ladder: a₁ = 3, a_{n+1} = 2a_n + 4, a₅. Why: each rung is built from the one below, so every rung is written. 3 → 10 → 24 → 52 → 108, rungs numbered 1 to 5, each computed on the board (2 × 52 + 4 = 108). Rule out: 52 is a₄, one rung short; it is the decoy. Sense: the terms roughly double, so a₅ is near 2 × 52. Trap: stopping a rung early; the numbered ladder.
Kind 4, the sum: a theater, first row 19, each row 2 more, 9 rows. Why, drawn: the nine rows as bars of 19, 21, …, 35 seats, to scale; a copy of the picture turned upside down and set on top makes a rectangle 9 rows tall and 19 + 35 = 54 wide; the rectangle holds the theater twice. (1) The last row: 19 + 8 × 2 = 35 (eight arcs). (2) Each pair, first with last, is 54. (3) 9 × 54 = 486, half of it: 243 seats. Said once as the method: the number of terms times the average of the first and last. Rule out: 171 is 9 × 19, every row the same; 486 is the doubled rectangle, never halved. Then the other two dresses, a beat each: Σ_{k=1}^{14}(3k − 6) says "k runs 1 to 14": first term −3, last 36, 14 terms, 14 × (−3 + 36)/2 = 231; "6 + 0 + (−6) + …, 12 terms": last term 6 − 11 × 6 = −60, 12 × (6 − 60)/2 = −324. Trap: forgetting to halve; adding the first and last only; miscounting the terms (Σ to 14 is 14 terms, not 13). The rectangle makes the halving visible; the strip counts the arcs to the last term.
Lines: "A recursive rule is a ladder: stand on every rung." "First and last make a pair; every pair is the same."
Kit: table arcs; a vertical `chain` as the ladder; bars to scale from `grid`, a copy that `turn`s a half turn and lands on top (exists).
Writer: strongest; four kinds, and the sum's insight is a motion (the half-turned copy) that a weak author describes instead of staging.