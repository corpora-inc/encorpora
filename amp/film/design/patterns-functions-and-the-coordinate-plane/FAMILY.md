# Patterns, functions and the coordinate plane, grade 3 to Algebra 2: family design

Nineteen skills, 79 problem types, grade 3 to Algebra 2. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, and the exact text of the 36 standards the types are judged to serve. This document is the family's idea, picture, habits, tools, seam and pilot. The per-type concepts apply these foundations through an example, a fast method, sense and accuracy checks, and a realistic misconception.

---

## 1. The idea underneath the whole family

**A rule takes a number in and gives exactly one number out, the same every time.** That is the whole family. In grade 3 the rule is "each box holds 7"; in grade 4 it is "start at 19, add 11"; in grade 5 two rules run side by side and each pair of matching outputs is a point; in grade 6 the two numbers get names and one is chosen while the other follows; in grade 8 the rule is called a function and the "exactly one" is made precise; in Algebra 1 the rule gets the name f and its outputs f(x), and its graph is all the points (x, f(x)); in Algebra 2 we do things to the rule (shift it, stretch it, chain two, run one backwards, ask where two agree) and watch the graph do the same thing. A learner who owns "one in, one out" and can turn a table into points and points into a curve owns the family. The rest is reading.

The foundations, in the order they are built. Later lessons stand on earlier ones and say so in one line.

### The rule (grades 3 to 4)

1. **A rule is an arrow: a number goes in, one number comes out, and the same number in always gives the same number out.** The table is the arrow's record, one row per input. "8 boxes in, 56 pencils out." Going backward ("how many boxes for 56 pencils") is the arrow run the other way: undo. A rule that is "times 7" is undone by "divided by 7". This is the seed of every inverse in Algebra 2.

2. **A pattern is a rule run step after step from a start, and the position counts the jumps, not the terms.** Term 1 has had zero jumps. The tenth term is the start plus nine jumps. Drawn as a strip (positions above, terms below, an arc for every jump labeled with the step), the arcs are what you count. Term n = start + (n − 1) × step is a count of arcs, not a formula to memorize. The features a rule leaves behind (add 50 never changes the ones digit, because 50 is five tens and no ones; add 3 from 1 alternates odd and even, because odd plus odd is even) are explained from the rule, which is what 3.OA.D.9 and 4.OA.C.5 ask and no multiple-choice item can check. The lesson teaches the why anyway.

### The plane (grades 5 to 6)

3. **A point is an address: across, then up.** Two number lines at right angles; the origin is zero on both. (3, 5) means go 3 along the x axis, then 5 up. Order matters: (5, 3) is a different place. The first number always goes with the first axis, and the axes' names match the coordinates' names (5.G.A.1's own words). Reading a point is the same move backward: drop straight down to read x, straight across to read y.

4. **Two rules side by side make pairs, and a pair is a point.** Matching terms (same position) are written (A, B). Plotted, they are dots; the table and the dots are one rule seen twice. The relationship between the patterns is itself a rule ("B is four times A"), and when both start at 0 the reason is visible: same number of jumps, each of B's jumps three times as big. This is the bridge from pattern to plane, and 5.OA.B.3 asks for the graphing explicitly.

5. **Zero is the mirror on each axis; the sign says which side.** Taken from family 3. (−3, 6) is 3 to the left; (−3, −6) is also 6 down. Flipping a point over the x axis changes the sign of y (the up-down number); over the y axis, the sign of x. Two points on the same grid line are as far apart as their differing coordinates are on a number line.

6. **In a relationship you choose one quantity and the other follows.** The independent quantity is the one you pick (weeks, hours, tickets); it goes in the left column and along the x axis. The dependent quantity follows from it (savings, pay, cost); right column, y axis. The equation says how the dependent one is computed from the independent one: y = something done to x. From a steady rate given as a total, the unit amount is total ÷ total ("75 sheets over 300 minutes is 0.25 a minute"), and the equation is s = 0.25m, never s = 75m.

### The function (grade 8 to Algebra 1)

7. **A function gives each input exactly one output.** Inputs may share an output; an input may not have two. In a list, look for a repeated first number with different second numbers. On a graph, look for two points stacked straight above each other: the vertical line test is the definition drawn, because a vertical line is one input and its crossings are that input's outputs.

8. **A graph is read left to right like a story: up is increasing, down is decreasing, flat is constant, steeper is faster.** The height is the quantity; left to right is time. The graph is not a picture of the path.

9. **f(x) is the name of the output at input x; the graph of f is all the points (x, f(x)).** f(3) means "put 3 in." f(x) = 251 means "which input gives 251?": read the graph backward or undo the rule. The domain is every input the function uses, the graph's shadow on the x axis; the range is every output, its shadow on the y axis. In a situation, the domain is only what makes sense: a count of cars is whole numbers, and a ferry that holds 13 cars stops at 13.

10. **A point is on the graph exactly when its two numbers make the equation true.** The graph of an equation is the picture of all its solutions (HSA.REI.D.10). To test a point, substitute. To find a missing coordinate, substitute the known one and solve. An intercept is a point with a zero in it: the x-intercept has y = 0, the y-intercept has x = 0.

11. **A sequence is a function whose inputs are the positions 1, 2, 3, …** a(4.5) does not exist because there is no four-and-a-halfth term. The explicit rule is foundation 2 written with letters: a(n) = a(1) + (n − 1)d. The recursive rule is a ladder, each rung built from the one below; to reach a(3) you must stand on a(2) first.

12. **The average rate of change between two inputs is the slope of the line through those two points of the graph.** Rise over run, from family 14, on any curve: change in output divided by change in input, in output units per input unit (people per year). Compute both outputs first, then the two differences, then divide.

### Doing things to a function (Algebra 2)

13. **Change the rule and every point moves the same way; follow one point.** f(x) + k lifts every point k. −f(x) flips every point over the x axis. k·f(x) stretches every height by k. Inside the parentheses the input has to undo the change first, so the graph does the opposite of what it reads: f(x + 3) reaches the old f(5) when x is 2, so every point slides 3 to the left. Following the vertex, the corner or any one marked point answers every match question. Even means the graph is its own mirror over the y axis (f(−x) = f(x)); odd means a half turn about the origin (f(−x) = −f(x)).

14. **Composition is two arrows in a row; the inverse is one arrow run backward.** f(g(x)) means g first, then f: inside out. In general the order changes the answer. f⁻¹ swaps every in and out: f⁻¹(−4) asks "which input gave −4?", the table's columns trade places, the graph flips over the line y = x. A function has an inverse only when no output comes from two inputs (the horizontal line test, the mirror image of foundation 7's vertical one), which is why a parabola must be cut at its vertex before it can be reversed.

15. **Where two graphs cross, the two outputs are equal, and that x solves f(x) = g(x).** Count the crossings to count the solutions. In a table, find the row where the outputs match, or the two rows between which their difference changes sign; test the halfway input to see which end is nearer.

### What must be defined, and when

| First needed | Words defined in plain language, with the picture |
|---|---|
| Grade 3 | rule, input and output ("the number that goes in, the number that comes out"), table |
| Grade 4 | pattern, term, position ("first, second, third"), step |
| Grade 5 | axis, x axis and y axis, origin, ordered pair, coordinates, point; matching terms |
| Grade 6 | independent and dependent quantity, equation, variable (letters stand for the quantities), quadrant |
| Grade 8 | function, input and output again, increasing, decreasing, constant |
| Algebra 1 | f(x), domain, range, sequence, common difference, explicit and recursive, average rate of change, intercept |
| Algebra 2 | transformation, even and odd, composition, inverse, one-to-one |

### What this family takes, and gives

Taken, named in one line when used, never retaught:
- **Family 6 and the number line (P3):** hops with the step on an arc; each axis is a number line.
- **Family 7:** equal groups, the times table and the array (grade 3 patterns are rows of a multiplication table; a growing shape pattern is an array gaining a row).
- **Family 3:** zero as the mirror; signs are sides.
- **Family 10:** the table with "× 7" between its columns; the unit rate from a total.
- **Family 11:** substitute to test; undo in reverse order to find an input.
- **Family 12:** evaluate in the conventional order, parentheses around a substituted negative; polynomial arithmetic for (f − g)(x).
- **Family 14:** the slope triangle. Average rate of change is that triangle between any two points of any graph.
- **Family 15:** the vertex and the axis of symmetry (shifted parabolas; cutting a parabola to make it one-to-one).
- **Family 16:** a logarithm undoes an exponential (the inverse of 2·4ˣ).
- **Family 26:** slide, flip, stretch. A graph transformation is one of those motions done to a curve.

Given: the plane and the table-to-graph link to family 14; f(x), domain and range to 15, 16, 17 and 18; transformations to 18 and 30; pairs as points to 33 (a scatter plot is this family's dots) and 31.

---

## 2. The visual language

Three pictures carry the family, each one a learner can sketch on scratch paper in ten seconds, each the same object from grade 3 to Algebra 2: **the table with its rule arrow**, **the plane with its points**, and **the graph as a curve**. A fourth, the **chain of arrows**, is the rule arrow lifted out of the table for Algebra 1 and 2. The principle that ties them: the table, the points and the curve are the same rule seen three ways, so the kit must be able to light the same pair in all three at once.

### The table and the rule arrow

A header row in small muted capitals, the input column (or row) in **blue**, the output column in **rust**, an unknown cell drawn as a gold-outlined "?" that is written on the word that finds it. Between an input cell and its output cell runs the **rule arrow**, teal, with the operation written on it: "× 7", "+ 2", later "f". Run backward (undo), the arrow turns around and its label becomes "÷ 7", "− 2", later "f⁻¹". That arrow is the function machine. There is no cartoon box; the arrow with the operation on it is what a child should draw.

For patterns the table is a **strip**: positions 1, 2, 3, … across the top in blue, terms beneath in rust, and above the terms an arc between every pair of neighbors labeled with the step ("+11"), the same arc the number line uses for hops. Arcs are counted aloud; terms never are. A growing shape pattern is drawn first as tiles (the new tiles each step in rust, the count under each step), and the counts then become the strip, so the child sees a shape pattern turn into a number pattern. A repeating shape pattern shows its unit under a bracket and stamps the next copy out of it.

The lesson uses the problem's own orientation: x over y in two rows when the app shows it that way (the STAAR layout), columns otherwise. For two patterns, A's row is blue and B's rust, because A is about to go across and B up.

### The plane

The plane in the film is the app's plane: the same unit grid, the same look, so the lesson's picture is the problem's picture. Light grid lines at every unit, numbers on both axes, the origin labeled, axis names at the ends (x and y, or the situation's names and units: "Weeks", "Dollars saved"). Everything to scale: one grid square is one unit, always. Points are dots with the letters the problem uses, placed clear of grid lines.

The x axis, the first number of every pair, and anything measured across are **blue**. The y axis, the second number, and anything measured up are **rust**. This is already the convention of the reference `line-slope` (run and rise in the fraction's colors) and `complex-plane-forms` (real blue, imaginary rust); this family says it aloud once in grade 5 ("the first number always goes across") and never changes it.

### The graph

A function's curve is **teal**; a second function, or the moved copy of the first, is **violet**; where the first one used to be is a **muted** ghost. Marked points carry their letters or their (x, y). The domain is a thick blue band on the x axis with a filled dot at a closed end and a hollow dot at an open end, the same catchment drawing as rounding's number line; the range is the same band in rust on the y axis. Between two points of a curve the slope triangle is drawn with a blue run along the bottom and a rust rise up the side, both labeled with their lengths, and the secant line dashed through them. A vertical test line is a thin gold line; the horizontal line y = c is dashed as the problem shows it. Piecewise graphs have their endpoints filled or hollow exactly as the rule says.

A story graph has no numbers: axes labeled with the quantity and "time", the curve through its lettered points, equal time spans marked when the problem says they are equal.

### The chain

Values in rounded boxes joined by labeled arrows, left to right: 1 → g → −8 → f → 7. A number travels along an arrow and its box fills when it arrives, so the middle value is seen, not skipped. For an inverse the arrowheads reverse and the labels gain ⁻¹. It is the table's rule arrow without the table, and a lesson may show them side by side once so the learner sees they are one thing.

### Colors mean one thing each

| Color | Means |
|---|---|
| **blue** | the input side: x, the first number of a pair, across, run, the domain, the independent column, pattern A |
| **rust** | the output side: y, the second number, up, rise, the range, the dependent column, pattern B |
| **teal** | the rule and its graph: the arrow, the curve, its points, f |
| **violet** | a second rule and its graph: g, the moved graph, a decoy curve |
| **gold** | the one thing being looked at now: the word in the question, the current input, the test line, the deciding row, the point being followed |
| **muted** | ghosts (where the graph was), the grid, placeholder cells, choices ruled out |

Never a tinted background on an answer; never a bar or axis that is not to scale.

### The motions, and what each one proves

- **Run the arrow.** The input slides along the rule arrow, the operation is read off it, the output appears in its cell. Proves foundation 1: the output is made by the rule, and the same input always makes the same output. Run backward on the word "undo".
- **Hop.** Arcs appear one at a time on the counting words ("one, two, three … nine jumps"), the term under the last arc goes gold. Proves foundation 2: the tenth term is nine jumps.
- **Across, then up.** From the origin a blue arrow runs along the x axis with a count ticking 1, 2, 3; from its end a rust arrow goes up with its own count; the dot drops. Done once in the wrong order (up 3, across 5) it lands somewhere else. Proves foundation 3.
- **Shadow.** Dashed lines fall from a point to both axes; the values land on the axes in the axes' colors. For a whole curve, dashed lines fall from its leftmost and rightmost points and the blue band grows between them; from its lowest and highest points for the rust band. Proves what coordinates are, then what domain and range are.
- **Row to point.** A table row lights gold and its dot lights with it; or the row slides out onto the plane and becomes the dot. Proves foundation 4: a table and a graph are one rule.
- **Mirror.** A point flips over an axis, leaving a ghost; the coordinate that changed sign flashes. Proves foundation 5.
- **Sweep.** The gold vertical line moves left to right across the whole graph; wherever it touches the curve twice, both points pulse and stay lit. Proves foundation 7 by showing one input with two outputs. The same sweep turned horizontal proves one-to-one, or not, in Algebra 2.
- **Glide along the story.** A dot rides the curve while the voice tells the story; beside each segment "up", "down" or "flat" appears as the dot passes, and a readout of the quantity ticks with the dot's height. Proves foundation 8 by making height the quantity, not the path.
- **Slope triangle.** Run and rise drawn between two points, the fraction written on the board in the same colors. Proves foundation 12 is family 14's picture.
- **Follow one point.** The curve moves to its image (shift, stretch, flip) leaving its ghost; one marked point glides with an arrow from its old place to its new one, the change written on the arrow ("+3", "× 2"). For a change inside the parentheses the label on the point shows the output staying the same while the input changes. Proves foundation 13.
- **Chain.** A number travels through two arrows; the middle box fills. Run in the other order, a different number comes out. Proves foundation 14's first half.
- **Reverse.** The arrows turn around; the table's two columns trade places; the curve flips over the dashed line y = x and a marked (a, b) lands on (b, a). Proves foundation 14's second half.
- **Cross.** Two curves; a dot at each crossing; two short dashes at the same height on both curves; a dashed drop to the x axis with the x in gold. Proves foundation 15, and that the answer is the x, not the y.
- **Dim.** Choices that cannot be right fade to muted together in one beat with the one reason said aloud. Never struck one by one.

### Scale and labels

Grids are unit grids and points sit where their numbers say. Axis numbers match the spoken scale. Every band, triangle and arrow is labeled with its value. Labels stay inside the card and clear of each other; the kit's layout note reports the rest. A story graph has no numbers but its shapes are honest: a steeper segment is drawn steeper, equal time spans are drawn equal.

---

## 3. How lessons in this family should go

Every film builds the same five habits, in the family's own terms.

**Read.** The problem is read exactly as the app shows it, with its choices. The word that sets the direction goes gold: "term" against "position"; "how many boxes" (backward) against "how many pencils" (forward); "domain" against "range"; "x-coordinate" against "y-coordinate"; "f(3)" against "f(x) = 3"; "f(x + 2)" against "f(x) + 2"; "f(g(x))" against "g(f(x))"; "not a function"; "which input x". Then one beat says what the answer must look like: a single number, a pair in parentheses, an equation with the dependent variable alone on the left, an interval with ≤ or <, a count.

**At a glance.** What is known before any work.
- A pattern that adds grows; the 10th term is about nine steps past the start. Its ones digit cycles with the step's ones digit.
- Two patterns both starting at 0: B is (B's step ÷ A's step) times A, and the quotient is a whole number in the app.
- A point's quadrant from its signs; whether it is left or right of the middle, above or below, before counting.
- In a list of pairs, a repeated first number is the only thing that can break a function.
- From a graph, the leftmost and rightmost x are the domain's ends; filled or hollow tells ≤ from <.
- f(−4) with an even power: the squared term is positive no matter what.
- The sign of an average rate of change from whether the second value is higher or lower than the first.
- Inside the parentheses is sideways and opposite; outside is up-down and as written.
- The innermost letter is done first.
- The number of crossings is the number of solutions; count the dots.

**The sure fast way.** Taught as the method, with the picture that explains it. A shortcut that sometimes fails is never taught.

| Question shape | The way that always works | Why it works |
|---|---|---|
| nth term from a start and an add or subtract rule | start + (n − 1) × step | the strip: the nth term sits after n − 1 arcs |
| rule from listed terms | take neighbor differences; constant difference means add; constant ratio means multiply; a changing difference is itself a pattern | the arcs' labels |
| feature of a pattern | write three terms, test every statement against them, then say why from the rule | one counterexample kills a statement |
| plot (a, b) | across a, then up b | foundation 3 |
| read a point | drop to the x axis, then across to the y axis | the shadow |
| equation from a table | the row with x = 0 gives the constant; the change in y per step of 1 in x gives the multiplier; from a total over a total, divide for the unit amount | foundation 6 |
| is it a function | scan the inputs for a repeat with different outputs; on a graph, sweep | foundation 7 |
| f(a) | substitute a in parentheses everywhere x appears, then evaluate in order | foundation 9 |
| f(x) = c | undo the rule in reverse order, or find height c on the graph and read its x | foundation 9 |
| domain or range of a graph | shadow the ends onto the axis; filled is ≤, hollow is < | the band |
| is (a, b) on the graph; missing coordinate | substitute both; substitute one and solve | foundation 10 |
| average rate of change | compute both outputs, then (output change) ÷ (input change) | the triangle |
| recursive term | compute every term in between, writing each | the ladder |
| graph after a change | move the vertex, corner or one marked point; the rest follows | foundation 13 |
| f(g(a)) | compute g(a), write it down, then f of that | the chain |
| f⁻¹(c) | solve f(x) = c; in a table find c in the output column and read its input | the reversed arrow |
| nearest tenth from a table bracket | test the halfway input; the side where the sign of f − g changes holds the solution | successive refinement, REI.D.11's own words. "Pick the end with the smaller difference" usually agrees and sometimes does not, so it is not taught |

**Sense.** Before the answer is boxed: the term is bigger than the start if the rule adds; the point lands in the quadrant the signs promised; the cost for more tickets is more; the domain of a count is whole numbers; a moved graph has the same shape; an inverse's answer, put back through f, gives what you started with; the solution of two crossing graphs is an x in the picture.

**Check.** After the answer: count the arcs one by one and land on the term; plot the answer and read it back; substitute the pair into the equation and read the true statement aloud; put the input back in and get the output; compose in the other order and see the difference; f(f⁻¹(−4)) = −4; evaluate both functions at the found x and see them agree.

**Rule out (multiple choice).** The decoys are the misconceptions, so the lesson names them as it dims them: the swapped pair (6, 4) for (4, 6) ("across first"); (4, 2) for a move of 4 right and 2 up ("that is the move, not where you stop"); s = 75m ("the total, not the amount per minute"); "both quantities are independent"; a range offered as a domain (0 to 169 dollars for a count of cars); "real numbers" for a count; a = g + 8 (the wrong quantity alone); a(4.5) ("no four-and-a-halfth term"); f(x − 5) + 3 for a shift 5 left ("inside is opposite"); "divide every x by 4" for 4f(x); a₁ = 8 for aₙ = 8n + 1 ("a₁ is the first term, 9, not the step"); "composition is commutative for every pair of functions" (a claim about all functions is never shown by one pair); "y = −1" when the question asks for an input x; a choice with the wrong sign for a rate that fell. Choices dim together, once, with one reason.

### What children actually get wrong here, and what makes it impossible

| Grade | The mistake | Why they make it | What in the picture kills it |
|---|---|---|---|
| 3 to 4 | 10th term = start + 10 × step (129 for 19 add 11) | counting terms, not jumps | the strip; arcs are the only things ever counted |
| 3 to 4 | answering the position instead of the term, or the step instead of the term | "the 6th one" | the term row is rust and the position row blue; the gold lands on the rust cell |
| 4 | "every number is odd" for add 50 from 89 after checking one term | one example felt like proof | three terms written before any statement is judged, and the reason said from the rule |
| 5 | (3, 5) plotted as (5, 3); reading (6, 4) as (4, 6) | no order rule owned | across-then-up done, then done wrong on purpose and landing elsewhere; "the first number always goes across" |
| 5 | reading 3 when the point is at 4, counting grid lines instead of gaps | counting from 1 at the first line | the across arrow's count ticks on the gaps |
| 5 to 6 | the move (4, 2) given as the destination | the two numbers in the problem | the arrow from A, then the shadow of where it stops |
| 6 | the wrong coordinate's sign flipped in a reflection | "over the x axis" heard as "x changes" | the mirror: flipping over the x axis moves the point up or down, so the up-down number changes |
| 6 | independent and dependent swapped | the bigger numbers, or the first-named quantity, feel like the result | "which one do you get to pick?": the chosen column is the left one, counting up by itself |
| 6 | s = 75m | the only number in the story that looks like a rate | 75 over 300 in the table, then one minute's worth |
| 8 | (−4, 2), (−3, 2) called "not a function" because 2 repeats | the rule half-remembered as "nothing repeats" | the sweep: both points pass the vertical line one at a time; a horizontal line is never the test here |
| 8 | the graph read as a picture of the path (a rising line means walking uphill) | the graph looks like a map | the gliding dot with the readout of distance ticking; "height is the quantity, left to right is time" |
| A1 | f(3) read as "f times 3" | the notation looks like a product | the arrow named f with 3 going in and 60 coming out; "f of three means put three in" |
| A1 | 5x² at x = −4 as −80 | the minus survives the square, or parentheses are skipped | the substitution written with (−4) in parentheses, the square evaluated first on the board |
| A1 | √(x + 1) − 5 at 48 as √48 + 1 − 5 | the root taken before the inside is finished | the inside written and finished on its own line, then the root |
| A1 | the wrong piece at a boundary (x = 1 put into 2x − 3) | ≤ and < not read | the input dropped on the x axis; the piece whose band holds it, filled end and all, lights |
| A1 | domain and range swapped; the range read as the two end points' heights only | which axis is which is not owned | blue band on x for domain, rust band on y for range, the bands grown from the curve's shadow |
| A1 | average rate of change left as the total change, or divided by the wrong gap; sign dropped when the value fell | the word "change" | the triangle with both legs labeled; the fraction in the legs' colors; the hypotenuse falls to the right so the sign is negative |
| A1 | a sequence's first term taken as the coefficient (a₁ = 8 for 8n + 1) | the explicit rule read as "start at 8, add 1" | a(1) computed first, on the strip |
| A1 | a₃ computed from a₁ directly, skipping a₂ | the rule applied once | the ladder: every rung written |
| A2 | f(x + 3) moved right; f(x) − 1 moved sideways | reading the sign as the direction | follow one point: the output f(5) now needs x = 2 |
| A2 | f(g(x)) done f first | left to right | the chain: the number enters g first; the other order produces a different number on screen |
| A2 | f⁻¹(x) = 1/f(x) | the exponent −1 | the reversed arrow; said once: the −1 is a label for "backward", not a power |
| A2 | the y of the crossing given as the solution | the point has two numbers | the drop to the x axis in gold; the equal heights are what the two sides share, the x is what solves it |

### Lines worth remembering

"Same in, same out." "The tenth term is nine jumps." "Across, then up; the first number always goes across." "Flip over an axis, and the number that measures distance from that axis changes sign." "You pick the input; the output follows." "One input, one output. Two points stacked straight up and it is not a function." "Read a graph left to right, like a story." "f of three means put three in." "On the graph means it makes the equation true." "Domain is the shadow on the x axis; range is the shadow on the y axis." "A sequence only has terms at whole positions." "Average rate of change is the slope between the two points." "Follow one point." "Inside the parentheses the graph does the opposite of what it says." "Inside out: the inner function first." "The inverse swaps in and out." "Where the graphs cross the outputs are equal; the answer is the x."

### Pacing and voice by grade band

Grades 3 to 5 use "the number that goes in" and "the number that comes out" until the problem itself writes x and y; then the film says once "x is the in-number, y is the out-number" and uses the letters. Nothing is struck out at these grades; the right move is shown instead. Grades 6 to 8 define each word on a `term` card or in passing and keep one idea per beat. Algebra 1 and 2 follow the sine lesson's lesson: the foundation is most of the film, patiently, because once "follow one point" or "inside out" is owned the problems are reading; a short "why" shot precedes each sub-skill's example rather than one long opening; the picture carries a number the board does not need to repeat; example numbers are chosen so the graph reads cleanly (a vertex clear of the axes, a crossing clear of grid intersections). Every multiple-choice problem is shown with its choices and the decoys are named as they dim.

---

## 4. Tools to build

### What exists

`axes` (step, every, ystep, yevery, xrange, yrange, `y: false` for a number line), `plot` with `upto`, `dot`, `label` with `@x`/`@y` readouts and `pin`, `glide` along a plot or circle, `view` and `stretch`, `seg` with `dash` and `extend`, `curve` through points, `grid` and `counters` (round, square), `table` (header, rows, cells, `highlight`, `given`), the board (`problem` with choices, `write`, `answer`, `term`, `watch`, `recap`), the app's own coordinate plane and graphs through `scene`. The slope triangle exists ad hoc inside `line-slope`. `dim` for choices is specified in the place-value design; if it has not landed, it lands with this family's first wave.

### New or extended, as specs

**4.1 `table` gains the rule arrow, arcs and links.**
- `orient: "rows"`: x across the top, y beneath (the STAAR layout). `inks` per row or column (`{"x":"blue","y":"warm"}`).
- `{"do":"fill","target":"t.cell.2.4","tex":"56","at":"fifty"}`: a gold-outlined "?" cell is written on the word. Cells may start as `"?"`.
- `{"do":"arc","target":"t.row.1","between":[3,4],"tex":"+11"}`: a hop arc above a row between two neighboring cells, the number line's arc; `{"do":"arcs","target":"t.row.1","tex":"+11"}` draws one per counted word with `nth`. A `count` label of arcs drawn so far.
- `{"do":"rule","from":"t.cell.1.3","to":"t.cell.2.3","tex":"\\times 7","id":"r"}`: the teal arrow from an input cell to its output cell with the operation riding it; `{"do":"run","target":"r"}` slides the input's value along it and fills the output; `{"do":"reverse","target":"r","tex":"\\div 7"}` turns it around. The same arrow between whole columns for "every pair follows the rule".
- `{"do":"link","target":"t.col.3","point":"P3"}`: the column (or row) lights gold and the named point on a plane in the same figure lights with it; `"slide": true` sends a copy of the pair out to become the dot.
- `diff: true` on a row or column: a live row of neighbor differences (finding the step; the sign change of f − g).
- `{"do":"swap","target":"t","cols":[1,2]}`: two columns trade places (the inverse's table).

**4.2 The plane: `axes` gains `grid`, names, the plotting path, shadows and the mirror.**
- `grid: true` (light unit lines), `names: ["Weeks","Dollars saved"]` or `["x","y"]` set at the axis ends in blue and rust, `origin: "O"`, `quadrants: true` when asked.
- `{"do":"plot","point":"P","path":true,"at":"across"}`: the across-then-up path from the origin (or from `"from":"A"`), the blue arrow's count ticking per unit, then the rust arrow, then the dot drops; `"order":"up-first"` for the deliberate wrong order.
- `{"do":"shadow","point":"P","to":"both"|"x"|"y"}`: dashed drops in the axes' colors; the coordinate values land on the axes.
- `{"do":"mirror","point":"K","over":"x"}`: the point flips to its image leaving a ghost; the changed coordinate flashes; the image is a new named point.
- `{"do":"between","points":["A","B"]}`: a labeled segment between two aligned points with its length, for the distance clause of 6.NS.C.8 should the app add a type for it.
- `numbers: false` for story graphs.

**4.3 Graph features on `plot`.**
- `vline` and `hline` parts (`{"id":"v","vline":-4,"ink":"gold"}`, `{"id":"h","hline":-3,"dash":true}`) with `{"do":"sweep","target":"v","to":4,"hits":true}`: the line moves and every crossing with the named curves pulses and stays lit.
- `interval` part on an axis: `{"id":"dom","interval":"x","from":-1,"to":2,"ends":["closed","open"],"ink":"blue"}`; `{"do":"project","target":"f","onto":"x"}` drops dashed lines from the curve's extremes and grows the band (the catchment drawing from rounding, now on an axis).
- `slopetri` part: `{"id":"tri","slopetri":["A","B"],"labels":true,"secant":true}`: run in blue, rise in rust, both labeled, the line through the points dashed. Promoted from `line-slope`'s ad hoc build.
- `plot` with `pieces`: `[{"expr":"-x-3","to":-3,"end":"closed"},{"expr":"-2x+5","from":-3,"to":1,"ends":["open","closed"]},{"expr":"2x-3","from":1,"end":"open"}]`: endpoint dots drawn as the rule says.
- `ghost` and `transform`: `{"do":"transform","target":"f","shift":[-3,0],"scale":[1,2],"reflect":"x","follow":"V","tex":"-3","leave":"ghost"}`: the curve moves to its image, leaving a muted copy; the point `V` glides with an arrow carrying the label; `"keep":"y"` on follow shows the output label unchanged while the input changes, for the inside-the-parentheses case.
- Intersection points: `{"meet":["f","g"],"n":1}` defines the nth crossing left to right so the author can dot it exactly; `{"do":"cross","points":["X1"],"drop":"x"}` draws the equal-height dashes and the drop.
- `glide` along a `curve` (polyline) for story graphs, with `{"do":"trend","target":"c","segment":2,"text":"up"}` writing the word beside a segment as the dot passes.

**4.4 `chain`.** `{"id":"c","chain":{"nodes":["x","g(x)","f(g(x))"],"arrows":["g","f"]}}`; `{"do":"run","target":"c","value":1}` sends 1 along, filling each box (−8, then 7) as it arrives; `{"do":"reverse","target":"c"}` flips the arrowheads and relabels with ⁻¹. Serves composition, inverses, and the f(a) / f(x) = c framing in Algebra 1.

**4.5 Shape patterns.** `counters` gain `shape: "triangle"` (and `"star"`); a `bracket` part over a run of grid cells with a label, for the repeating unit; `{"do":"stamp","target":"u","to":["g",7]}` copies the unit into the next cells.

**4.6 `dim`** for choices, shared with place value.

Board: `problem` must set piecewise definitions (`\begin{cases}`) and the STAAR `\begin{array}` tables cleanly in the card; verify, and fix if the renderer clips them.

### Build order

1. **Table extensions, the plane's path, shadow and mirror, `dim`.** Grades 3 to 6: 31 types, and the table-to-point link that families 10, 14 and 32 will reuse.
2. **Graph features: sweep, intervals, slope triangle, piecewise plots, ghost and transform, intersections, story glide.** Grade 8 to Algebra 2: 46 types, and the same pieces unlock families 14 to 18 and 33 (the curriculum's step 6).
3. **`chain`.** Composition and inverses, 7 types, plus the Algebra 1 notation framing.
4. **Shape-pattern bits.** Two types.

Each piece is built to the depth this family's concepts ask; family 14 extends the plane, family 15 the vertex markers, family 18 the asymptotes.

---

## 5. Who writes what

**Strongest writer, because the insight is a motion or the lesson teaches reading:**
- The lessons where a picture is born and every later lesson points back: `rule-pattern-term` (the strip and the jump count), `first-quadrant-coordinates` and `coordinate-move` (across, then up), `pattern-pair-relationship` (pairs become points), `plot-points` (the mirror), `relation-function-choice` (the definition and the sweep), `graph-domain-range` (the shadows), `graph-after-shift` and `shift-function-notation` (inside is opposite: the hardest explanation in the family), `composition-value` (order), `inverse-value` and `inverse-expression` (swap; cutting the parabola), `graphical-solution-table` and `rational-abs-solution-count` (the answer is the x).
- The mixed types that have no recipe and live or die on choosing the example that exposes the reading: `situation-pair-table` (forward, backward, rate), `rule-pattern-feature` (the explain-why), `coordinate-context-points`, `line-graph-reader`, `independent-dependent-roles`, `story-graph-match` and `distance-graph-meaning` (graph as story, not path), `piecewise-reading`, `series-recursion`, `transform-equation`, `transform-point`, `compare-representations`, `rational-function-representation`.

**A capable cheaper model (concept written, kit complete, strong review after), because the method is one and the picture is a named action that `--dry` and the math check can verify:**
- Computation with a fixed path: `arithmetic-term`, `arithmetic-distant-term`, `recursion-term-steps`, `nonlinear-recursion-term`, `function-evaluation`, `radical-function-value`, `sat-entry-fn-linear-notation`, `piecewise-evaluate`, `average-rate-formula`, `average-rate-display`, `average-rate-table-rounded`, `average-rate-steps`, `solution-point-choice`, `solution-coordinate`, `intercept-point-choice`, `dependent-variable-value`, `composition-expression`, `fl-function-arithmetic`, `inverse-exponential-root`, `shifted-polynomial-features`, `fl-even-odd-classify`.
- Reading and placing with one picture: `coordinate-point-reading`, `point-on-signed-grid`, `first-quadrant-locate`, `point-on-axis-sentence`, `coordinate-terms-slots`, `graph-of-paired-values`, `graph-absolute-value-points`, `graph-sqrt-points`, `graph-of-quadratic-or-exponential`, `relation-point-removal`, `function-pair-select`, `function-missing-input`, `graph-is-function`, `function-relation-test`, `context-domain-range`, `arithmetic-sequence-as-function`.
- Tables with one rule: `times-table-pattern`, `neighbor-product-change`, `rule-table-fill-slots`, `pattern-rule-choice`, `pattern-term-unknown-rule`, `growing-shape-pattern`, `repeating-shape-pattern`, `related-patterns-relationship`, `staar-table-rule-choice`, `table-rule-sentence`, `additive-multiplicative-select`, `staar-rate-equation-choice`, `dependent-variable-equation`, `table-equation-slots`, `composition-order-choice`.

The reviewer for either group must be at least as strong as the writer, and an independent reviewer watches every lesson of the first wave.

---

## 6. What in the app's problem types should change, and what the standards ask that the problems never practice

> Base cases and trick questions are wanted in the app; a flag here means a weak main example or a wrong shelf, never a type to drop.

**Misfiled or badly conceived**
- `series-recursion` holds three things under one name: sums of arithmetic series (no standard in this skill covers sums; they are family 16's `sequence-sums`), recursive-to-explicit translation (the core of HSF.BF.A.2), and a term from two table rows (HSF.LE.A.2). Split into three; move the sums.
- `piecewise-reading` holds three things: counting solutions of f(x) = c from a graph (HSA.REI.D.11), the rule of one piece (8.F.B.4), and rewriting an absolute value as pieces (HSA.SSE.A.2). Split; the solution-count case belongs with `graphical-equation-solving`.
- `rational-function-representation` is family 18 (rational functions) and family 17 (solving 3/(x − 3) + 2 = 5, HSA.REI.A.2); only its match-the-graph case is HSF.IF.C.9.
- `line-graph-reader` is a data-display reading type (family 32); it rides here on the same plane and stays, but its concept should borrow family 32's language.
- `fl-function-arithmetic` is polynomial arithmetic (family 12) in function clothes; acceptable under HSF.BF.A.1b, but its lesson should name the overlap and not reteach distribution.
- `inverse-expression` holds three cases (restrict a domain, write the inverse, mirror a point); one lesson of three cases is fine, but `facts.ts` should list them so the concept covers each.
- The skill `function-notation` (grade 8) has no function notation in it; it is the definition of a function. Rename or expect the lesson not to introduce f(x).
- `graph-of-quadratic-or-exponential` shows only parabolas in its examples; confirm the exponential case generates, or rename.
- `arithmetic-sequence-as-function` appears to make a(4.5) the answer every time; vary the non-integer input, or the type is one memorized answer.
- `relation-function-choice`'s correct answer includes the same pair twice, (−4, 2), (−4, 2); a true but subtle case. Fine in the app; a weak main example.

**Below or above grade**
- `repeating-shape-pattern` (grade 3): repeating patterns have no Common Core standard and belong to K to 2 in the states that have them; keep it short.
- `rule-table-fill-slots` (grade 4), `staar-table-rule-choice` and `additive-multiplicative-select` (grade 5) write rules as y = x + 2 and y = 5x; letters standing for numbers are 6.EE.A.2. Grade 4 should see "in" and "out"; grade 5 can meet x and y if the film defines them. `staar-table-rule-choice` has a decoy table with negative outputs (−1, −3, −5, −7) at grade 5; negatives are 6.NS.
- `pattern-term-unknown-rule` with shrinking differences (15, 22, 28, 33, 37) is a second-difference pattern, past 4.OA.C.5; a stretch item, and the lesson says the difference is itself a pattern.
- `table-equation-slots` (grade 6) finds both the multiplier and the added constant from a table: that is rate of change and initial value, 8.F.B.4. 6.EE.C.9's own example is d = 65t, one step.
- `neighbor-product-change` and `times-table-pattern` are shared with family 7 (3.OA.D.9); their lessons should use the array split, which is the distributive property the standard asks to be explained.

**Clauses the problems never practice** (exact words)
- 5.OA.B.3: "graph the ordered pairs on a coordinate plane" and "explain informally why this is so." No type plots the pairs; the lessons for `pattern-pair-relationship` and `related-patterns-relationship` should plot them anyway and give the jump explanation.
- 6.NS.C.8: "Include use of coordinates and absolute value to find distances between points with the same first coordinate or the same second coordinate," and "real-world problems" in four quadrants. No type; a gap for the alignment list (the `between` action is specified above against the day it is added).
- 6.EE.C.9: "Analyze the relationship ... using graphs and tables, and relate these to the equation": the graph half is thin; only tables and stories appear.
- 8.F.B.5: "Sketch a graph that exhibits the qualitative features of a function that has been described verbally," and "linear or nonlinear" as a described feature. No sketching type; linearity is never asked.
- HSF.IF.A.2: "interpret statements that use function notation in terms of a context." C(9) is computed, never interpreted ("what does C(9) = 69 mean?").
- HSF.IF.C.7b: "step functions" and "cube root" are never graphed.
- HSF.BF.A.2: "use them to model situations." No sequence comes from a context.
- HSF.BF.B.3: "find the value of k given the graphs"; f(kx) as a correct answer rather than a decoy; "recognizing even and odd functions from their graphs" (only algebraic classification appears).
- HSF.BF.B.4b: "Verify by composition that one function is the inverse of another." Never.
- HSF.IF.B.6: "Estimate the rate of change from a graph." The graph type gives exact points.
- HSA.REI.D.11: "exponential, and logarithmic functions" never appear among the crossing graphs; "explain why the x-coordinates ... are the solutions" is taught by the film, never asked.
- 4.OA.C.5 and 3.OA.D.9: "explain informally why" and "explain them using properties of operations." Multiple choice cannot ask it; every pattern lesson teaches it.

---

## 7. The pilot

Five types, one per grade band, covering the family's whole arc and every new tool in one sitting, and so that each later lesson can point back to one of them.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `rule-pattern-term` | 4 | The strip is born: positions over terms, arcs counted on the words, "the tenth term is nine jumps." The off-by-one trap that follows children into Algebra 1. Exercises table arcs and the elementary voice. |
| 2 | `first-quadrant-coordinates` | 5 | The plane is born: across then up, the shadow back to both axes, the swapped-pair decoys dimmed with one reason. Exercises the path, shadow and `dim`, on the app's own plane. |
| 3 | `relation-function-choice` | 8 | The definition: pairs listed, then plotted, then the sweep; the repeated output that is fine beside the repeated input that is not. Exercises row-to-point and the sweep. |
| 4 | `sat-entry-fn-linear-notation` | A1 | f(a) forward ("put 9 in") and f(x) = c backward (undo), in a context, with the arrow named f. Ties grade 3's rule arrow to notation and to family 11's undo; exercises `chain`. |
| 5 | `graph-after-shift` | A2 | Follow one point: the ghost, the image, the vertex's arrow labeled with the move; f(x) − 1 as every point down one; the graph moved 3 right with the inside-is-opposite reason said once with the point. Exercises `transform` and `follow`. |

If the five land, the next wave is `plot-points` (the mirror), `pattern-pair-relationship` (pairs to points, and the plotting the standard asks for), `graph-domain-range` (the bands), `average-rate-display` (the slope triangle as a part), `shift-function-notation`, `composition-value` and `graphical-solution-table`, which complete the tool set and the foundations list.
