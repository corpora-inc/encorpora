# Patterns, functions and the coordinate plane, part 7: transformations, composition, function arithmetic (Algebra 2)

Ten problem types from two skills. Planning sources: the family design, `facts.ts` variants, the exact standard text.

## Shared, before the per-type concepts

**One opening picture serves eight of these ten types, and it is the same picture every time: a graph, one marked point, and what happens to that point.** The family's foundation 13 in one shot, drawn live, never recited:

- A curve (teal) with one marked point, say the corner or vertex, labeled with its pair.
- **Outside the parentheses, as written, acting on height.** `f(x) + 2`: the curve lifts to its image (violet) leaving a muted ghost; the point glides straight up with an arrow labeled "+2"; its x does not move. `2f(x)`: every height doubles, the point's arrow labeled "× 2". `−f(x)`: flip over the x axis.
- **Inside the parentheses, opposite, acting on the input.** `f(x + 3)`: the voice says the reason with the point, once: "the height that used to be at x = 5 is now needed when x + 3 = 5, so at x = 2. The height stays; the input moves 3 left." The point's label shows its y held while its x changes. The curve slides left.
- The line, said once and put on the board: **"Outside: up and down, as written. Inside: sideways, opposite. Follow one point."**

Each film shows only the slice of this it needs (the family's rule: a short "why" shot before each sub-skill's example, not one long opening), but the slice is the same drawing, so a learner who has seen one of these lessons recognizes the next.

**A kit gap that cuts across the group.** Four of these types (`graph-after-shift`, `graph-of-quadratic-or-exponential`, the drawn case of `transform-equation`) have choices that are graphs. The app shows four small planes; `facts.ts` prints them as sentences. The film must show the choices as the learner sees them: a **graph-choice panel**, four small labeled planes (A to D) beside the problem card, same unit grid as the main figure, that `dim` can fade together and `highlight` can light. The `problem` card lists the letters. This is new kit and it lands with this wave.

Also needed from the family's section 4: `transform` with `follow`, `leave: "ghost"` and `keep: "y"`; `chain`; `dim`; `vline`/`hline`; `meet`. Nothing else below needs a new picture unless named under **Kit**.

---

## Function transformations (`function-transformations`, Algebra 2, HSF.BF.B.3)

### `graph-after-shift` — Follow one point to the moved graph. (Pilot lesson 5)

**Standard.** HSF.BF.B.3: "Identify the effect on the graph of replacing f(x) by f(x) + k ... and f(x + k) for specific values of k (both positive and negative)." Only shifts here; k, kx and even/odd belong to the siblings.

**Foundations first.** Define *shift* ("every point moves the same distance the same way; the shape does not change"). Then the shared opening, shifts only: the point lifted by `+ k` outside; the point slid by `f(x + k)` inside, with the reason said on the point. Define *corner* and *vertex* as "a point you can find again after the move". Nothing else before the example.

**Read.** "The graph of y = f(x) is shown. Which graph shows y = f(x − 3)?" The change is *inside*, so the move is sideways; the sign is minus, so the move is right. The answer is the same shape, 3 units to the right. In the words form ("moved 2 units to the left and 1 unit up") there is nothing to decode: move the point as it says.

**Example.** The zigzag through (−2, −1), (−1, −2), (1, 0), (2, 2); g(x) = f(x − 3). Choices: four small zigzags, the panel. (1) Mark the corner (−1, −2), the lowest point: its height is −2, and that height belongs to the input −1. (2) Where does g have height −2? g(x) = f(x − 3) needs f's input to be −1: x − 3 = −1, x = 2, on the board. (3) The point glides from (−1, −2) to (2, −2) with the arrow "+3"; its label shows the height −2 unchanged. "The height stays. The input moves right 3." (4) The whole graph follows, leaving its ghost. (5) The choice through (2, −2): light it. (6) Second point: (2, 2) → (5, 2); the lit choice passes through it.

*Quick case* (outside, as written): a line through (−2, −4) and (3, 6); y = f(x) − 1: every point down 1: (−2, −5), (3, 5). The arrow on one point labeled "−1", straight down. Two beats and the answer. (Lines are a weak main example: a slanted line slid right and up by the right amounts lands on itself, so a corner is what the film follows.)

**Fast.** Inside: sideways, opposite sign. Outside: up or down, as written. Move one corner, choose the graph through it, confirm with a second point.
**Sense.** The answer has exactly the shape shown, nowhere stretched or flipped.
**Check.** A second point of the original, moved the same way, lies on the chosen graph.
**Rule out.** The up-3 and down-3 graphs read the 3 as vertical, but the change is inside the parentheses; the left-3 graph reads the minus sign as left. All three dim together: "inside, so sideways; minus, so right."
**Line.** "Inside is sideways and opposite. Follow one point."
**Trap.** f(x − 3) moved left (the sign read as the direction); the −3 read as down. The reason said on the point (the height at input −1 is now reached at x = 2) and the arrow labeled "+3" make it impossible to see the move as left or down.
**Kit.** Graph-choice panel; `transform` with `follow`, `keep: "y"`, ghost.
**Writer.** Strongest. The whole lesson is one motion and one explanation said at exactly the right moment; a weak author describes it instead of staging it.

### `shift-function-notation` — Write the moved function.

**Standard.** HSF.BF.B.3, the same clause, run backward: given the effect, write the replacement of f(x).

**Foundations first.** The shared opening, shifts only, with the board writing the notation as each move happens: lift the point 3, write `f(x) + 3`; slide it 5 left, write `f(x + 5) + 3`, with the reason: "the height that f gave at x = 2 must now appear at x = −3; −3 + 5 is 2, so the inside is x + 5." Define *vertex form* only in the second example, where it appears.

**Read.** "The graph of g is the graph of f shifted 5 units to the left and 3 units up. Which equation defines g?" Two moves, two places to write them: left or right goes inside with the opposite sign; up or down goes outside as written. At a glance: "left" means a plus inside; "up" means a plus outside; so the answer has two plus signs with 5 inside and 3 outside.

**Example.** The abstract case, drawn on a V with vertex (2, −1). (1) Up 3: the V lifts, the vertex to (2, 2); board: g(x) = f(x) + 3. (2) Left 5: the vertex to (−3, 2). The height at (−3, 2) is the height f had at 2, plus 3. g(−3) = f(2) + 3. Which inside gives 2 when x is −3? x + 5. Board: g(x) = f(x + 5) + 3. (3) Read the choices; dim; light.

*Second example, a different case* (a rule with numbers in it, where the constants combine): f(x) = x² + 5 shifted 2 left and 5 down. Vertex (0, 5) → (−2, 0). Inside: (x + 2). Outside: + 5 − 5 = 0. g(x) = (x + 2)². The learner must see that the written +5 and the move down 5 are two different things that add. Decoys: (x − 2)² (sign), (x + 2)² + 10 (down taken as up), (x + 5)² + 3 (inside and outside swapped).

**Fast.** Left/right: inside, opposite sign. Up/down: outside, as written. Then combine constants.
**Sense.** The chosen rule's vertex is where the moved vertex landed.
**Check.** Substitute the moved vertex's x into the chosen g: it must give the moved vertex's y.
**Rule out.** The choice with the vertical number inside and the horizontal number outside swaps the roles: gone. The choice with a minus inside for a left shift reads the sign as the direction: gone. The choice with the wrong outside sign: gone. One beat, one reason each.
**Line.** "Outside as written; inside opposite."
**Trap.** f(x − 5) for 5 left. Killed by the board writing g(−3) = f(2) + 3 before the inside is chosen: the inside must turn −3 into 2.
**Kit.** Nothing beyond the shared tools.
**Writer.** Strongest. Same motion, same reason, said in the backward direction; the second example's constant arithmetic is easy, but the first example's reasoning is the family's hardest explanation.

### `transform-equation` — Read a transformation off a graph or a description.

**Standard.** HSF.BF.B.3: "Identify the effect on the graph of replacing f(x) by f(x) + k, k f(x), f(kx), and f(x + k) ... find the value of k given the graphs." Three shapes under one name: describe the effect of one change in words; write the equation of a named parent after a chain of moves; read the equation off a dashed parent and a solid image. One idea, three readings.

**Foundations first.** The shared opening, all three motions: `+ k` lifts, `k f(x)` stretches every height from the x axis (heights double; a height of 0 stays 0; a negative k also flips), `f(x + k)` slides opposite. Define *vertical stretch* ("every height multiplied by the same number") and name the parents the type uses (x², x³, √x, |x|) in one line each as pictures.

**Read.** "The dashed curve is y = x². Which equation describes the solid curve?" Find the vertex: it tells the inside and the outside. Find the direction: it tells the sign of a. One more point tells the size of a. At a glance: the solid opens down, so a is negative, and two of the four choices are already gone.

**Example.** Dashed y = x², solid y = −(x + 2)² + 1. (1) The solid's vertex is at (−2, 1): shadow it to both axes. (2) The parent's vertex (0, 0) went left 2 and up 1: inside (x + 2), outside + 1; write y = a(x + 2)² + 1 with a still unknown. (3) It opens down, so a is negative. (4) One step across from the vertex, the parent rises 1; the solid falls 1: a = −1. (5) y = −(x + 2)² + 1. Light it.

*Second example, a different case* (a chain of moves in words, where order matters): y = √x shifted 2 right, stretched vertically by 2, then shifted 3 up. Follow (0, 0): right 2 → (2, 0); stretch leaves 0 at 0; up 3 → (2, 3). Follow (1, 1) too: (3, 1) → (3, 2) → (3, 5). y = 2√(x − 2) + 3; check: x = 3 gives 2·1 + 3 = 5. The decoy 2√(x − 2) + 6 is the stretch done after the lift (3 × 2); the problem says stretched, *then* up, so the 3 is added last and is not doubled.

*One beat* for the words shape: "y = 4f(x): multiply every y coordinate by 4." Dividing, and anything done to x, are the decoys.

**Fast.** Vertex gives inside and outside; direction gives the sign of a; one more point gives its size. For a chain: follow one point through the moves in the order given.
**Sense.** The chosen equation's vertex form says where the vertex is; look at the picture.
**Check.** Substitute the vertex and the one more point into the chosen equation.
**Rule out.** Wrong direction (sign of a) and wrong vertex (sign inside, sign outside) dim together with their reasons.
**Line.** "Vertex first, then direction, then one more point."
**Trap.** Reading the inside sign as the vertex's x (x + 2 placed at 2). The shadow onto the x axis lands on −2 before any equation is written.
**Kit.** Graph-choice panel (drawn case); ghost and image.
**Writer.** Strongest. Three readings of one idea with the example chosen to expose the a-from-one-point step; mixed types need the author to choose, not follow.

### `transform-point` — Where one point goes.

**Standard.** HSF.BF.B.3 (the effect of k f(x), f(x) + k, f(kx), and "recognizing even and odd functions"); HSF.IF.A.2 "evaluate functions for inputs in their domains". Three genuinely different cases: an outside change read from a graph; a symmetry statement; an inside multiplier. `facts.ts` should list them.

**Foundations first.** The shared opening, with the board translating each move into what happens to a point's two numbers: outside acts on y (multiply, then add); inside acts on x; even means the mirror over the y axis is the same graph, so (−x, y) is on it whenever (x, y) is; odd means the half turn about the origin is the same graph, so (−x, −y) is. Define *even* and *odd* by those two motions, drawn.

**Read.** "The graph shows y = f(x). Let g(x) = −2f(x) − 1. What is g(−1)?" g(−1) means put −1 into g. g is built from f, so first find f(−1) on the graph, then do what the outside says: times −2, then minus 1. The x never moves.

**Example** (case A). The shown curve has height 6 at x = −1. (1) Board: g(−1) = −2·f(−1) − 1. (2) On the graph: up from x = −1 to the curve, across to 6. (3) −2(6) − 1 = −13. (4) The point (−1, 6) glides to (−1, −13): the height stretched by −2 (through the axis to −12), then down 1; the x stayed.

*Case B* (symmetry). f is odd and f(5) = −5. The point (5, −5) half-turns about the origin to (−5, 5): both signs change. f(−5) = 5. One beat for even: f(5) = 4, mirror to (−5, 4), f(−5) = 4.

*Case C* (inside multiplier). (1, 3) on f; on f(3x) it moves to (p, 3). The height 3 belongs to f's input 1; now the inside must be 1: 3p = 1, p = 1/3. The point slides toward the y axis to a third of its x; its height is unchanged.

**Fast.** Outside: take the height and do what is written. Even: copy y. Odd: flip both signs. Inside: solve for the x that makes the inside equal the old x.
**Sense.** An outside change leaves x alone; a negative multiplier puts a positive height below the axis.
**Check.** The image point lies on g drawn as the transform of f; for odd, the half turn lands on it; for f(3x), 3 · (1/3) = 1.
**Line.** "Outside changes the height. Inside changes the input. Even copies; odd flips both."
**Trap.** For odd, f(−5) = −5: only the x flipped. The half turn visibly carries the point to the opposite corner. For case A, applying −2 and −1 to the input (looking up f at some other x). The board writes −2·f(−1) − 1 before anything is read.
**Kit.** `mirror` about the origin (a half turn, not just over an axis) for the odd case.
**Writer.** Strongest, as the family assigned: three cases, and the odd-function half turn must be staged, not stated.

### `shifted-polynomial-features` — A feature of a shifted polynomial.

**Standard.** HSF.BF.B.3 (f(x) + k, f(x + k)); HSF.IF.A.2 (evaluate g(0)); HSF.IF.C.7a "show intercepts, maxima, and minima". SAT-style entries: vertex x of f(x ± c); g(0) for f(x) + k; sum of intercepts of f(x + c).

**Foundations first.** The shared opening for inside shifts, on a parabola: f slides left c when written f(x + c); its vertex and its zeros slide with it, all by the same c. One line from family 15: the vertex of ax² + bx + c is at x = −b/2a, and a factored polynomial's zeros are read off its factors.

**Read.** "f(x) = x² + 6x + 21, g(x) = f(x + 2). At what x does g reach its minimum?" Two steps: find f's own minimum x; then slide it as the inside says. At a glance: +2 inside means left, so the answer is 2 less than f's vertex x.

**Example.** (1) f's vertex: x = −6/2 = −3; f(−3) = 12; the parabola drawn with (−3, 12) marked. (2) g(x) = f(x + 2): the lowest height f has, 12, is reached when x + 2 = −3, so at x = −5. (3) The curve slides left 2 leaving its ghost; the vertex glides to (−5, 12) with the arrow "−2". (4) −5.

*Quick case* (zeros): f(x) = x(x − 4)(x + 4), zeros −4, 0, 4; g(x) = f(x + 4): each zero left 4: −8, −4, 0; the three dots slide together. Sum −12. (Fast: old sum minus 3 · 4.)
*One beat* (value): g(x) = f(x) + 9, g(0) = f(0) + 9 = (3)(5)(−1) + 9 = −6; outside, so evaluate and add.

**Fast.** Find f's feature; then inside shift moves every x of it by the opposite of the sign; outside shift adds to every y.
**Sense.** The vertex of a slid parabola is just as high as before and sits where the slide put it.
**Check.** g(−5) = f(−3) = 12, and g(−4) = g(−6) = f(−2) = f(−4) = 13: equal heights either side of −5, so −5 is the axis. (Or expand g to x² + 10x + 37 and take −10/2.)
**Line.** "Find the feature of f, then move it the way the shift says."
**Trap.** f(x + 2) moved right, giving −1. The arrow on the vertex is labeled "−2" and the reason is said on it. Also: skipping f's own vertex and reading a coordinate out of the rule (6 or 21). The board computes −b/2a first.
**Kit.** Nothing beyond the shared tools; zeros as a set of dots that slide together.
**Writer.** Cheaper model. Fixed path, numbers checkable, the picture a named action.

### `graph-of-quadratic-or-exponential` — Match a parabola to its rule.

**Misnamed.** Every generated variant is a parabola; no exponential case appears despite the name, the goal and the method. Either fix the generator or rename the type; the lesson below teaches parabolas only and must not promise exponentials. If the exponential case lands, it needs its own quick example ((0, a) and (1, ab); the side that levels off).

**Standard.** HSF.BF.B.3 (f(x − h) + k) and HSF.IF.C.7a "Graph ... quadratic functions and show ... maxima, and minima." Two wordings: "f(x) = x² is shown; which graph shows f(x − 2) − 1?" and "which graph shows y = −½(x − 3)² + 4?"

**Foundations first.** The shared opening on the parabola y = x²: its vertex (0, 0), one step across rises 1, two across rises 4. The three things that place a parabola: where the vertex is (inside gives x, opposite; outside gives y, as written), which way it opens (the sign of a), how wide (a's size: a = ½ means half the parent's rise). Define *vertex* in one line (lowest point opening up, highest opening down).

**Read.** "Which graph shows y = −½(x − 3)² + 4?" Vertex (3, 4), opens down, half as steep. At a glance: any choice opening up is gone, and any whose vertex is not at (3, 4) is gone, before counting a single unit.

**Example.** The four small graphs in the panel. (1) Inside x − 3: the vertex's x is 3 (opposite sign). Outside + 4: its y is 4. Shadow (3, 4) on the main plane. (2) a is negative: opens down. (3) a is ½: two across from the vertex, the parent would rise 4; this one falls 2: through (5, 2) and (1, 2). (4) The panel choice with the vertex at (3, 4), opening down, through (5, 2): light it.

*Quick case*: f(x) = x² shown; f(x − 2) − 1: follow the vertex right 2, down 1 to (2, −1); the parabola is the parent's shape, so the width needs no check.

**Fast.** Vertex: inside opposite, outside as written. Sign of a: direction. Then a point one or two across.
**Sense.** A negative a puts the vertex at the top of the picture.
**Check.** Substitute the vertex and one more point into the rule.
**Rule out.** Vertex at (−3, 4): the inside sign read as written. Vertex at (3, −4): the outside sign wrong. Opens up: the sign of a ignored. All dim together.
**Line.** "Inside opposite, outside as written; the sign in front says which way."
**Trap.** The vertex at (−3, 4) for (x − 3)². The reason on the point: the parent's height 0 is at input 0, and x − 3 = 0 when x = 3.
**Kit.** Graph-choice panel.
**Writer.** Cheaper model, once the panel exists: one method, one named picture, every number checkable.

### `graph-sqrt-points` — Where a square-root graph starts, and three sure points.

**Standard.** HSF.IF.C.7b "Graph square root ... functions". The rule is a√(x − h) + k, so HSF.BF.B.3's effects are the tools, but the practiced act is graphing by hand.

**Foundations first.** The parent y = √x, built live: it starts at (0, 0) because a negative number under the root has no real square root, so there is nothing to the left; its root is a whole number only at the perfect squares 1, 4, 9, so (1, 1), (4, 2), (9, 3) are the points to plot. Then the shared opening on this curve: inside slides the start sideways (opposite), outside lifts it, a in front multiplies the rise above the start (a negative a turns the curve downward from the start). Define *radicand* ("the number under the root") in passing.

**Read.** "Graph y = −2√(x + 4) + 1 by placing its starting point and 2 more points." The start is where the radicand is 0. The other points are where the radicand is 1, 4, 9. At a glance: x + 4 = 0 at x = −4, so the start is at the left end at x = −4, and −2 in front means the curve goes down from there.

**Example.** (1) Start: x + 4 = 0, x = −4; y = −2·0 + 1 = 1. The parent's start (0, 0) glides to (−4, 1), arrows "−4" and "+1". (2) Radicand 1: x = −3; y = −2·1 + 1 = −1. The parent's rise of 1 is doubled and flipped: down 2 from the start. (3) Radicand 4: x = 0; y = −2·2 + 1 = −3. (4) The curve through the three points, falling to the right, nothing left of x = −4. (Radicand 9, x = 5, y = −5, as a fourth if the picture has room.)

**Fast.** Radicand 0 gives the start (h, k). Then x = h + 1, h + 4, h + 9 and y = k + a, k + 2a, k + 3a.
**Sense.** The start is the left end; a positive a rises from it, a negative a falls.
**Check.** Substitute one plotted point: −2√(0 + 4) + 1 = −3.
**Line.** "The root is zero at the start. Then one, two, three at the squares."
**Trap.** Starting at x = +4 for x + 4. The radicand set to zero on the board before anything is plotted. Also choosing x = −2 (radicand 2, no whole root) and guessing its height; the lesson only ever uses perfect squares and says why.
**Kit.** Nothing beyond the shared tools; the app's own plane with its placed points.
**Writer.** Cheaper model. One method, one picture, every point checkable.

### `fl-even-odd-classify` — Even, odd or neither.

**Standard.** HSF.BF.B.3: "Include recognizing even and odd functions from their graphs and algebraic expressions for them." The app practices only the algebraic half; the lesson shows both, so the words mean a picture.

**Foundations first.** Two motions on a graph. Even: fold over the y axis and the graph lands on itself (x² − 2, drawn; the point (1, −1) and its mirror (−1, −1)). Odd: half turn about the origin and the graph lands on itself (x³ − 3x; (1, −2) and (−1, 2)). Then what f(−x) is: the graph flipped left to right. So if f(−x) comes out the same as f(x), the flip changed nothing: even. If f(−x) comes out as −f(x), the flip gave the graph upside down, which a half turn undoes: odd. Then the one algebra fact, shown on two terms: (−x)² = x² and (−x)³ = −x³, because an even count of minus signs multiplies to a plus. So replacing x by −x flips the sign of every odd-power term and leaves every even-power term, and a constant is x⁰, even.

**Read.** "Let f(x) = −4x⁴ + 4x² − x. Which statement correctly finds f(−x) and classifies f?" Two jobs: write f(−x) correctly, then compare it with f(x) and with −f(x). At a glance: the powers are 4, 2 and 1, a mix of even and odd, so some terms will keep their sign and one will flip, and the answer is "neither."

**Example.** (1) f(−x) = −4(−x)⁴ + 4(−x)² − (−x), every −x in parentheses. (2) Even powers keep: −4x⁴ + 4x². Odd power flips: − (−x) = + x. f(−x) = −4x⁴ + 4x² + x. (3) Against f(x): the last term differs. Against −f(x) = 4x⁴ − 4x² + x: the first two differ. Neither. (4) The graph of f, flipped left to right, lands on neither itself nor its upside-down copy: the lopsided M with its taller hump on the left.

*Quick case* ("Which function is even?"): scan powers only. 3x⁴ − 6x³ + 6 has a 3: no. x: odd. x² − 2: powers 2 and 0, all even: yes. −3x² − x: mixed.

**Fast.** Look at the exponents (a constant counts as even). All even: even. All odd: odd. Mixed: neither. This always works for polynomials, and it is exactly what computing f(−x) does term by term.
**Sense.** A function with a constant term can never be odd; a function with a plain x term can never be even.
**Check.** Test one input: f(1) = −1, f(−1) = 7; neither equal nor opposite.
**Rule out.** A statement whose f(−x) kept the odd term's sign ("−x" unchanged) is wrong before the verdict is read: dim. Among the three with the right f(−x), the verdict is decided by the term-by-term comparison; name "the signs changed, so odd" as the half-read: *some* signs changed, not all.
**Line.** "Even: the mirror is the same graph. Odd: the mirror is the graph upside down. Mixed powers: neither."
**Trap.** Dropping the parentheses, so −(−x)⁴ becomes +x⁴ or (−x)³ becomes −x only in the mind; and reading "the signs changed" as odd without checking that *every* sign changed. The board writes every (−x) in parentheses, evaluates the power first, and compares term by term.
**Kit.** `mirror` over the y axis for a whole curve, and the half turn about the origin; the left-right flip of a curve as a `transform` with `reflect: "y"`.
**Writer.** Cheaper model. One method with a shortcut that always works and a picture that explains it; every line checkable.

---

## Function composition (`function-composition`, Algebra 2, HSF.BF.A.1)

### `composition-order-choice` — Does the order matter?

**Standard.** HSF.BF.A.1c "(+) Compose functions." A plus standard, beyond the core; fine in Algebra 2. The choices also test a logic reading: "for these two functions" against "for every pair of functions."

**Foundations first.** Composition as a chain (the family's `chain`, the rule arrow out of the table): x → g → g(x) → f → f(g(x)). Define: f(g(x)) means g first, then f; "inside out". Then run a number through both orders with f(x) = 2x − 2 and g(x) = x² − 1: 2 → g → 3 → f → 4; and 2 → f → 2 → g → 3. Different numbers out. One sentence: "In general the order changes the answer; sometimes it happens not to." Say once what f(g(x)) is not: not f(x) times g(x).

**Read.** "Let f(x) = 2x − 2 and g(x) = x² − 1. Which statement about f(g(x)) and g(f(x)) is true?" Compute both, in order, then compare. At a glance: the chain already gave different numbers for x = 2, so every choice saying they are equal is gone; only the two "order matters" choices remain, and they differ by which expression is which.

**Example.** (1) f(g(x)): g goes in first. Replace every x in f with (x² − 1): 2(x² − 1) − 2 = 2x² − 4. (2) g(f(x)): replace every x in g with (2x − 2): (2x − 2)² − 1 = (2x − 2)(2x − 2) − 1 = 4x² − 8x + 4 − 1 = 4x² − 8x + 3. (3) Not the same. Order matters. (4) The choice with f(g(x)) = 2x² − 4 and g(f(x)) = 4x² − 8x + 3.

*Second example, a different case* (the pair that agrees, and the logic): f(x) = x − 2, g(x) = x − 3. f(g(x)) = (x − 3) − 2 = x − 5; g(f(x)) = (x − 2) − 3 = x − 5. Equal. The choice says "for these two functions the order does not matter." The other equal choice says "so composition is commutative for every pair of functions": the first example is a pair for which it is not, so one agreeing pair proves nothing about all pairs. Dim it with that reason.

**Fast.** Innermost letter first; substitute the whole inner expression in parentheses; simplify; compare.
**Sense.** With a square in one function and a linear in the other, the two orders usually differ (2(x²) against (2x)²).
**Check.** Put x = 2 into both final expressions: 2·4 − 4 = 4 and 16 − 16 + 3 = 3, the chain's numbers.
**Rule out.** Expressions like x² − 5x + 6 or 2x³ − 2x² − 2x + 2 are the product f(x)·g(x), not a composition: dim. Equal-or-not is settled by one number through the chain before any algebra.
**Line.** "Inside out: the inner function first. One pair agreeing proves nothing about every pair."
**Trap.** Composition done as multiplication (the product decoys exist because of it); f(g(x)) done f first (left to right); (2x − 2)² expanded as 4x² − 4. The chain makes the order a motion; the square is written as (2x − 2)(2x − 2).
**Kit.** `chain` with `run` in both orders.
**Writer.** Cheaper model, with the second example and the "every pair" reasoning written here so the logic is not left to the author.

### `fl-function-arithmetic` — Add, subtract, multiply, divide two functions.

**Where it belongs.** This is polynomial arithmetic (family 12, HSA.APR.A.1 "add, subtract, and multiply polynomials") in function clothes; it sits here under HSF.BF.A.1b "Combine standard function types using arithmetic operations." The lesson names the overlap in one line ("you add these the way you add any two polynomials") and does not reteach distribution; the one new idea is what (f − g)(x) means and what the quotient's domain is.

**Foundations first.** Define (f + g)(x) = f(x) + g(x), (f − g)(x) = f(x) − g(x), (fg)(x) = f(x)·g(x), (f/g)(x) = f(x)/g(x): "the new function's height at x is the two heights at x, combined." One picture, one beat: two curves, the two heights at x = 1 drawn as segments, the difference between them. Then: a quotient has no height where the bottom is 0, because division by 0 is not allowed, so those inputs leave the domain.

**Read.** "Let f(x) = 3x² − 2x − 5 and g(x) = −2x² + x − 5. Which expression is (f − g)(x)?" Write f(x) minus g(x) with parentheses around all of g, then take the minus to every term. At a glance: a difference of two quadratics is at most quadratic, so the x⁴ choice is nonsense; and f − g with f's leading 3x² minus g's −2x² starts 5x², which leaves one choice.

**Example.** (1) (f − g)(x) = (3x² − 2x − 5) − (−2x² + x − 5). (2) The minus to every term of g: 3x² − 2x − 5 + 2x² − x + 5. (3) Like terms: 5x² − 3x. (4) 5x² − 3x.

*Second example, a different case* (the quotient's domain): f(x) = x − 1, g(x) = x² + x − 20. Only the bottom matters: x² + x − 20 = (x + 5)(x − 4) = 0 at x = −5 and x = 4. Domain: x ≠ −5 and x ≠ 4. On a number line, hollow dots at −5 and 4. The top's zero, x = 1, is allowed: 0 divided by a nonzero number is 0.

*Quick case* ((fg)(x)): (−4x − 6)(2x − 7), every term by every term: −8x² + 28x − 12x + 42 = −8x² + 16x + 42. Two beats.

**Fast.** Parentheses around each whole formula; for a difference, the minus to every term of the second; for a product, every term by every term; for a quotient's domain, solve bottom = 0 and leave those out.
**Sense.** Sum or difference: the degree does not go up. Product: the degrees add. Quotient: the forbidden inputs are the bottom's zeros, never the top's.
**Check.** Substitute x = 1: f(1) = −4, g(1) = −6, f − g = 2; 5(1) − 3(1) = 2. For the domain: g(4) = 16 + 4 − 20 = 0.
**Rule out.** The quartic is a product, not a difference: gone. −5x² + 3x is g − f, the wrong way round: gone. 5x² − x − 10 took the minus to g's first term only: gone. For the domain: x ≠ 1 is the top's zero; x ≠ −4 and 5 are the factors' signs read backward.
**Line.** "Minus the whole thing: the sign goes to every term. A quotient has no height where the bottom is zero."
**Trap.** The minus applied to g's first term only (the decoy 5x² − x − 10 is exactly this). Parentheses drawn around all of g, and each term's sign flipped on screen one at a time. For the domain: excluding the top's zero.
**Kit.** Nothing new; a number line with hollow dots for the domain (exists).
**Writer.** Cheaper model. Family 12 arithmetic with the math check as the net; the two definitions are written here.

---

## Notes for the alignment list

- `graph-of-quadratic-or-exponential`: no exponential variant generates. Rename or fix.
- `transform-point`: three cases under one name; `facts.ts` should list them so a concept covers each.
- `composition-order-choice`: HSF.BF.A.1c is a (+) standard; keep, but label it as beyond the core.
- HSF.BF.B.3's "find the value of k given the graphs" is practiced only inside `transform-equation`'s drawn case (a from one more point); f(kx) appears only as `transform-point`'s one case and otherwise as a decoy; "recognizing even and odd functions from their graphs" is never asked. The lessons teach all three anyway.
