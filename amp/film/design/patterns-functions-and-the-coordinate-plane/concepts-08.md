# Patterns, functions and the coordinate plane: part 8 concepts

Four skills, nine problem types, all Algebra 2: composition, inverses, comparing representations, solving by graphs and tables. Written from the family design. Two pictures do almost all the work here: **the chain** (foundation 14: two arrows in a row, or one arrow run backward) and **the cross** (foundation 15: where two graphs meet the outputs agree and the answer is the x). One habit runs through every multiple-choice type in this part and is worth saying as its own thing: **one number through the chain kills the decoys.** Put a single easy input through the real functions, then through each choice; a choice that gives a different number is gone. It always works as a rule-out, it is faster than algebra, and it is the check the standards ask for (HSF.BF.B.4b's "verify by composition" is exactly this).

Pacing follows the sine lesson's lesson: the foundation is most of each film, patiently, because once "inside out" and "the inverse swaps in and out" are owned, the problems are reading.

---

## Function composition (`function-composition`, HSF.BF.A.1)

### `composition-value` — Evaluate f(g(a)) from formulas or graphs

**First:** the goal promises tables, but no table variant generates; the lesson covers formulas and graphs and the writer should confirm whether a table case exists before adding a beat for it. The domain question is a genuinely different act hiding under this name (a backward question, HSF.IF.A.2's "inputs in their domains"); it gets its own worked example below.

**Standard.** HSF.BF.A.1c: "(+) Compose functions." HSF.IF.A.2: "evaluate functions for inputs in their domains."

**Foundations first.** The rule arrow from grade 3, named in one line: a number goes in, one comes out. Composition is two arrows in a row: the output of the first is the input of the second. Define the notation in plain words: f(g(x)) is "f of g of x"; the inner letter is done first, because its output is what f receives. (f ∘ g)(x) is the same thing written short; the small circle reads "after": f after g. Then the one fact that must be proved before any example: order changes the answer. Send 1 through g then f and watch 7 come out; send the same 1 through f then g and watch a different number come out; both chains stay on screen. "Inside out: the inner function first."

**Read.** The word that sets the order goes gold: the letter nearest the x. For (f ∘ g)(1), g is nearest. The answer is one number. For "which x is not in the domain", the answer is an input, not an output.

**The example.** Let f(x) = |x + 1| and g(x) = −3x − 5. What is (f ∘ g)(1)?
(1) Rewrite the circle: (f ∘ g)(1) = f(g(1)); the g goes gold. (2) The chain: three boxes, 1 → g → ? → f → ?. (3) The 1 travels along the g arrow; the board writes g(1) = −3(1) − 5 = −8; the middle box fills with −8. (4) −8 travels along the f arrow: f(−8) = |−8 + 1| = |−7| = 7; the last box fills. (5) Answer 7.

**Second example (the domain case).** Let f(x) = 3/(x + 5) and g(x) = −2x − 3. Which x is not in the domain of f(g(x))? (1) The chain x → g → f, with a gold mark on f's arrow: f cannot take −5, because 3/(−5 + 5) divides by zero. (2) So the question is: which x does g send to −5? Run g backward from −5: −2x − 3 = −5; add 3: −2x = −2; divide by −2: x = 1. (3) The chain shows 1 → g → −5 → f → stop. (4) Answer 1. Said once: g itself takes every number, so the only break is the one f makes.

**Quick case (graphs).** (f ∘ g)(−2) from two graphs: on g's graph drop a gold line at x = −2, read its height; that height is carried over and becomes the x on f's graph; read f's height there. Three beats; the kit carries the number from one y axis to the other x axis.

**Fast.** Compute the inner value, write it down, then the outer. For the domain: find the input the outer function refuses, then run the inner function backward from it.

**Sense.** f = |x + 1| is never negative, so 7 is the right kind of number. For the domain case, the answer is an x that g sends to −5: g(1) = −5, so it is.

**Check.** g(1) = −5 ✓, f(−8) = 7 ✓. Run the other order once, g(f(1)) = g(2) = −11, and see that it differs: order matters.

**Line.** "Inside out: the inner function first."

**Trap.** Doing f first because f is written first. The chain only admits the number at g's end. Also, in the domain case, answering −5 (the value f refuses) instead of the x that reaches it; the chain shows −5 in the middle box, not the first.

**Kit.** `chain` with a forbidden mark on an arrow and a backward run from a value; a carry from one graph's y axis to another graph's x axis.

**Writer.** Strongest: the order proof and the backward domain run are the lesson, and a weak author will describe the chain instead of running it.

### `composition-expression` — Write f(g(x)) as one expression; split h into outer and inner

**Standard.** HSF.BF.A.1c: "(+) Compose functions," forward (compose) and backward (decompose).

**Foundations first.** The chain again, but the box in the middle holds an expression, not a number: x → f → 4x − 5 → g → (4x − 5)² + 5. The expression travels as one package, so wherever g's rule says x, the whole package goes, in parentheses. Then one line from family 12, named not retaught: a squared binomial has three terms, (4x − 5)² = 16x² − 40x + 25, the area model. Decomposition is the same chain read backward: lay h over the outer function and whatever stands where the outer's x stands is the inner.

**Read.** The order (gold on the inner letter) and the act: "which expression equals" is compose; "can be written as f(g(x)) with f = … which is g" is decompose. For compose, the answer has the degree of the outer applied to the inner: a quadratic outside a linear inside is a quadratic.

**The example (compose).** Let f(x) = 4x − 5 and g(x) = x² + 5. Which expression equals g(f(x))? Choices: 4x² + 15; 16x² − 40x + 30; 4x³ − 5x² + 20x − 25; x² + 4x.
(1) f is inner: the package is 4x − 5. (2) Write g's rule with an empty box: ( )² + 5; the package slides into the box: (4x − 5)² + 5. (3) Expand the square as three terms: 16x² − 40x + 25 + 5. (4) Collect: 16x² − 40x + 30.
Rule out, before the algebra: one number through the chain. f(0) = −5, g(−5) = 30, so the answer is 30 at x = 0. The choices give 15, 30, −25, 0: three dim at once. Name them as they go: 4x² + 15 is f(g(x)), the other order; the cubic is f times g; x² + 4x is f plus g.

**Second example (decompose).** h(x) = (2x − 2)² + 4 = f(g(x)) with f(x) = x² + 4. Which is g? Choices: (2x − 2)²; 2x − 2; 2x; x − 2.
(1) Lay h over f: (2x − 2)² + 4 over x² + 4. The x of f has become 2x − 2. (2) That is the package f received, so g(x) = 2x − 2. (3) Said in chain words: what does h do to x first? Doubles it and takes 2 away; that is the inner job.
Rule out: (2x − 2)² already contains the square, which is f's job; f of it would square twice. 2x and x − 2 are pieces of the inner job: f(2x) = 4x² + 4 is not h. The variant that gives g and asks for f is the same overlay read the other way; one beat.

**Fast.** Compose: write the outer rule with an empty box, drop the inner in, expand, collect. Decompose: overlay h on the outer; what sits where x sat is the inner.

**Sense.** The degree: linear inside quadratic outside is degree 2, so the cubic was never possible.

**Check.** One number through the chain and through the chosen expression agree (x = 1: f(1) = −1, g(−1) = 6; 16 − 40 + 30 = 6 ✓). For decompose, run f(g(x)) forward and land on h.

**Line.** "The inner expression goes in as one package, in parentheses."

**Trap.** (4x − 5)² written as 16x² − 25 (squaring term by term): the three-term expansion is written out. Composing in the wrong order: the chain says which letter is inner. In decompose, taking the whole squared bracket as g: the overlay shows the square belongs to f.

**Kit.** `chain` with expression nodes and an empty-box fill; `dim`.

**Writer.** Capable cheaper model: one fixed method, the picture is a named action, and the test-a-number rule-out is checkable by the math check.

---

## Inverse functions (`inverse-functions`, HSF.BF.B.4)

### `inverse-value` — Find f⁻¹(b) from a formula, a table or a graph

**Standard.** HSF.BF.B.4a: "Solve an equation of the form f(x) = c for a simple function f that has an inverse." HSF.BF.B.4c: "(+) Read values of an inverse function from a graph or a table, given that the function has an inverse." HSF.BF.B.5 only for the 2ˣ − 3 variant, and lightly: 2ˣ = 2 needs no logarithm.

**Foundations first.** The rule arrow, then reversed: the inverse swaps in and out. f⁻¹(b) asks one question, said plainly: "which input gave b?" Define one-to-one (each output comes from only one input), because that is what makes the question have one answer; the table and graph variants say the word. Said once, with the arrow on screen: the −1 is a label for "backward," not a power; f⁻¹(x) is not 1 over f(x). The picture: f's arrow as its steps (add 6, divide by 4), then the arrow turned around and its steps turned around, read from the other end.

**Read.** The notation f⁻¹ goes gold: it means find the input. The answer is an input: on a graph, an x; in a table, something from the left column.

**The example.** Let f(x) = (x + 6)/4. What is f⁻¹(−4)?
(1) f⁻¹(−4) means: f(x) = −4. Which x? (2) f's chain: x → +6 → ÷4 → −4. (3) Reverse it, from the right: −4 → ×4 → −16 → −6 → −22; on the board, (x + 6)/4 = −4, multiply both sides by 4: x + 6 = −16, subtract 6: x = −22. (4) Answer −22. (5) Forward check on the same chain: (−22 + 6)/4 = −16/4 = −4 ✓.

**Quick case (table).** f⁻¹(8): find 8 in the output column (gold), read across to its input, 1. The columns trade places on the word "swap" so the learner sees f⁻¹'s table is f's table with the columns switched.

**Quick case (graph).** f⁻¹(4): draw the dashed line y = 4, find where it meets the curve, drop to the x axis: x = 2. "Read the graph backward: height first, then x."

**Fast.** Set f(x) = b and undo f's steps in reverse order; in a table find b among the outputs; on a graph find height b and read its x.

**Sense.** f divides by 4, so an output of −4 needs a big negative input; −22 is the right size and side.

**Check.** Put the answer back through f and get b: f(−22) = −4.

**Line.** "The inverse swaps in and out: f⁻¹ of b asks which input gave b."

**Trap.** Reading f⁻¹(−4) as 1/f(−4) = 2: the reversed arrow is the only picture of f⁻¹ on screen, and the −1 is called a label aloud. Undoing in forward order ((−4 − 6) × 4 = −40): the reversed chain is read from its right end, step by step. On the graph, starting at x = 4: the dashed line is horizontal.

**Kit.** `chain` with unary step arrows and `reverse`; `table` `swap`; `hline` with a drop to the x axis.

**Writer.** Strongest: the swap idea and the −1 notation are where this fails invisibly.

### `inverse-expression` — Write f⁻¹(x); restrict a domain so one exists

**First:** the goal promises mirroring a point across y = x, but no such variant generates; the lesson shows the mirror as the foundation anyway, because it is why the swap works. Two acts live here: writing an inverse (linear, and a restricted quadratic) and choosing the domain on which a quadratic has one. Each gets its screen.

**Standard.** HSF.BF.B.4a: "write an expression for the inverse." HSF.BF.B.4d: "(+) Produce an invertible function from a non-invertible function by restricting the domain."

**Foundations first.** The swap, drawn: a point (a, b) on f is the point (b, a) on f⁻¹; the whole graph flips over the dashed line y = x. That is why the method is "write y = f(x), swap x and y, solve for y": swapping the letters is swapping in and out. Then the test, built as the mirror of grade 8's vertical line: a horizontal line is one output; if it meets the graph twice, that output came from two inputs and the backward arrow cannot choose. A parabola fails: the horizontal sweep lights two points on every line above the vertex. Cut it at the vertex, keep one side, and every horizontal line hits once. Said once: the cut is at the vertex's x, which for (x − 3)² is x = 3, the number that makes the inside zero.

**Read.** "Which expression is f⁻¹(x)": the answer undoes f. "On which domain does it have an inverse": the answer is one side of the vertex, x ≥ h or x ≤ h, and h is the number that zeros the bracket.

**The example (linear).** Let f(x) = 3x + 2. Which is f⁻¹(x)? Choices: x/3 − 2; (x + 2)/3; (x − 2)/3; 3x − 2.
(1) y = 3x + 2. Swap: x = 3y + 2. (2) Solve for y: subtract 2, x − 2 = 3y; divide by 3, y = (x − 2)/3. (3) Beside it the chain says the same: f is ×3 then +2; backward is −2 then ÷3. (4) Answer (x − 2)/3.
Rule out with one number: f(1) = 5, so f⁻¹(5) must be 1. (5 − 2)/3 = 1 ✓; 5/3 − 2, 7/3 and 13 are not. Name them: x/3 − 2 undoes in the wrong order; (x + 2)/3 forgot to turn +2 into −2; 3x − 2 only changed a sign.

**Second example (restricted quadratic).** f(x) = (x − 3)² + 2 with domain x ≤ 3 is one-to-one. Which is f⁻¹(x)? Choices: −√(x + 2) − 3; −√(x − 2) + 3; −√(x − 3) + 2; √(x − 2) + 3.
(1) Picture: the parabola, vertex (3, 2), its right half ghosted, the left half teal; it flips over y = x into a half-curve. (2) y = (x − 3)² + 2; swap: x = (y − 3)² + 2; subtract 2: x − 2 = (y − 3)²; root: y − 3 = ±√(x − 2); y = 3 ± √(x − 2). (3) Which sign? The inverse's outputs are f's inputs, and those are at most 3, so take the minus: y = −√(x − 2) + 3. (4) One number: f(1) = 4 + 2 = 6, so f⁻¹(6) must be 1. −√4 + 3 = 1 ✓; +√4 + 3 = 5, which is on the discarded side. The other two choices have the 2 and the 3 in the wrong places, and dim together.

**Quick case (the domain).** f(x) = (x − 3)² − 3: horizontal sweep hits twice; cut at the vertex x = 3; x ≥ 3 is the choice offered. x ≥ 0 and x ≥ −3 use the −3 instead of the 3, or the wrong sign; "all real numbers" is the uncut parabola.

**Fast.** Swap x and y, solve for y. For a square root, the sign follows the kept side of the domain. For the domain, cut at the number that zeros the bracket.

**Sense.** The inverse of a linear is linear; of a half-parabola, a half-root. Its outputs land on the kept side.

**Check.** f(f⁻¹(c)) = c for one number, and the chosen domain's side gives back the input used.

**Line.** "Swap x and y, then solve: the inverse trades in and out."

**Trap.** The vertex of (x − 3)² taken as −3: the bracket is zeroed on the board. The wrong branch of the root: one number from the kept side settles it. Undoing in forward order (x/3 − 2): the chain is read from its right end.

**Kit.** A curve flipped over the dashed line y = x (`reverse` for graphs); a horizontal `sweep` with hits; ghosting half of a plot at a cut.

**Writer.** Strongest: the mirror, the cut and the sign choice are motions that prove, and the design names this lesson as one later lessons point back to.

### `inverse-exponential-root` — The inverse of an exponential; recover f from a cube-root inverse

**Standard.** HSF.BF.B.4a: "write an expression for the inverse" (the example f(x) = 2x³ is the standard's own). HSF.BF.B.5: "(+) Understand the inverse relationship between exponents and logarithms." Two acts, two examples: writing the inverse, and reading f back from f⁻¹ (an inverse's inverse is the function).

**Foundations first.** One line from family 16, named: log base 4 of x asks "4 to what power gives x?", so log₄ undoes 4ˣ, the way ÷2 undoes ×2 and the cube root undoes the cube. Then the chain as steps: f(x) = 2·4ˣ is x → 4ˣ → ×2. Reverse it from the right: ÷2, then log₄. Every inverse here is a chain reversed; the swap-and-solve algebra on the board is that reversal written down.

**Read.** "What is the inverse": undo the steps backward. "The inverse is … which equation defines f": reverse the inverse's steps. The answer's shape is known at a glance: the inverse of an exponential is a logarithm in the same base; the inverse of a cube root is a cube.

**The example (exponential).** What is the inverse of f(x) = 2·4ˣ? Choices: (log₄ x)/2; log₄ x − 2; log₄(x/2); 2 log₄ x.
(1) The chain: x → 4ˣ → ×2. (2) y = 2·4ˣ; swap: x = 2·4ʸ. (3) Undo the last step first: divide by 2, x/2 = 4ʸ. (4) Undo the power: y = log₄(x/2). (5) Answer log₄(x/2).
Rule out with one number: f(0) = 2, so f⁻¹(2) must be 0. log₄(2/2) = log₄ 1 = 0 ✓; (log₄ 2)/2, log₄ 2 − 2, and 2 log₄ 2 are not zero. Name them: dividing by 2 after the log instead of before; treating ×2 as +2; multiplying instead of dividing.

**Second example (recover f).** The inverse of f is f⁻¹(x) = ∛(x − 4)/2. Which defines f? Choices: 8x³ + 4; 8x³ − 4; 2x³ + 4; x³/8 + 4.
(1) f⁻¹'s chain: x → −4 → ∛ → ÷2. (2) f reverses it from the right: ×2, then cube, then +4: f(x) = (2x)³ + 4. (3) (2x)³ = 8x³, the 2 is cubed too: f(x) = 8x³ + 4. On the board the same thing by swap: x = ∛(y − 4)/2; 2x = ∛(y − 4); (2x)³ = y − 4; y = 8x³ + 4. (4) Answer 8x³ + 4.
Rule out: f⁻¹(12) = ∛8/2 = 1, so f(1) = 12. 8 + 4 ✓; 4, 6 and 4⅛ are not.

**Fast.** List f's steps, reverse the list, write it as a formula. For an exponential, get the power alone, then take the log in that base.

**Sense.** The base of the log is the base of the power; the inverse of a root is a power.

**Check.** One number forward through f and back through the chosen inverse returns to the start.

**Line.** "Undo the last step first."

**Trap.** (2x)³ written as 2x³: the 2 travels inside the cube on the board. Dividing by 2 after taking the log: the chain is read from the right end, and ÷2 comes first. ×2 undone as −2.

**Kit.** `chain` with unary step arrows and `reverse`; nothing else.

**Writer.** Capable cheaper model: one fixed path, the test-a-number rule-out, every line checkable.

---

## Cross representation comparison (`cross-representation-comparison`, HSF.IF.C.9)

### `compare-representations` — Compare a feature of f (formula) with g (graph or table)

**First:** the variant f(x) = (x)² has stray parentheses in its template; fix it. The type is one method under three features (maximum or minimum value, y-intercept, a value f(a) against g(a)) and two sources for g; the method is "get the same number from each form, then read the statements against the two numbers."

**Standard.** HSF.IF.C.9, whose own example is this type: "given a graph of one quadratic function and an algebraic expression for another, say which has the larger maximum."

**Foundations first.** What "maximum value" means: the height of the top point, the y of the vertex, never its x; shown on a graph with a dash from the vertex across to the y axis in rust. How each form gives the vertex, named from family 15 in one line each: vertex form a(x − h)² + k reads off (h, k); standard form needs x = −b/2a, then substitute for the height; a graph shows its top point; a table of a quadratic turns around at its vertex, and when two rows share an output the vertex sits midway between them. The y-intercept is the output at x = 0: the constant term, the row x = 0, the crossing of the y axis. Opening up has a minimum; opening down (a negative) a maximum.

**Read.** The feature goes gold ("maximum value", "y-intercept", "f(2) = g(2)"). The answer is one of four statements, and once two numbers are found, three statements are settled at once.

**The example.** f(x) = −x² + 6x − 11; the graph shows g. Which statement is true? Choices: g has the greater maximum; f(2) = g(2); f has the greater maximum; f and g have the same maximum.
(1) f opens down (a = −1): a maximum exists. (2) x = −b/2a = −6/(−2) = 3. (3) f(3) = −9 + 18 − 11 = −2; the board writes "max of f: −2" and the picture plots f's vertex (3, −2) in teal beside g's graph. (4) g's top point: read its height from the graph with the rust dash to the y axis (the writer takes the value from the figure; the answer says it is −2, at a different x). (5) Equal heights: same maximum value, even though the vertices are at different x. (6) The leftover statement: f(2) = −4 + 12 − 11 = −3; compare with g(2) read from the graph; it was already false once the "same maximum" statement was true, but it is read aloud and dismissed.

**Quick case (table).** f(x) = −(x − 1)² and a table of g: f's maximum is 0, read straight off vertex form; g's outputs rise then fall, and the top row's output is g's maximum; compare. The y-intercept variant is one beat: f(0) is the constant term, g(0) is the x = 0 row.

**Fast.** Get the feature's number from each form, then read the statements against the pair.

**Sense.** A maximum is above every other output of its function: f(2) = −3 sits below −2 ✓. A maximum belongs to a parabola opening down.

**Check.** f(2) and f(4) both equal −3, symmetric about x = 3 and below the vertex. Re-read the graph's top point.

**Line.** "The maximum is the height of the top point, not where it is."

**Trap.** Reporting the vertex's x (3) as the maximum: the rust dash to the y axis is the only thing ever called the maximum. Reading "same maximum" as "same vertex": the two vertices are drawn at different x with one height.

**Kit.** A vertex marker with a dash to the y axis; `table` with the turning row highlighted and symmetric rows linked.

**Writer.** Strongest: the lesson teaches reading three forms and judging four statements, and the decoys are the misconceptions.

### `rational-function-representation` — Match a fraction rule to its graph or table; find the input for an output

**First:** misfiled. Matching the rule is family 18 (rational functions); solving 3/(x − 3) + 2 = 5 is family 17 (HSA.REI.A.2). Only the match-the-graph case is HSF.IF.C.9's spirit. The lesson is written here because the type is filed here, but it borrows those families' pictures and should move when they are designed.

**Standard.** HSF.BF.B.4a: "Solve an equation of the form f(x) = c" (the find-the-input case is inverse-value thinking). HSA.REI.A.2: "Solve simple rational ... equations in one variable." The match cases serve HSF.IF.C.9 loosely.

**Foundations first.** What the rule 3/(x − 3) + 2 does to x, as a chain: subtract 3, then 3 over that, then add 2. Two things the chain shows before any graph: x = 3 is refused (3 over zero), and far from 3 the fraction is tiny, so the output settles near 2. On the graph those are the two dashed lines: the vertical one at the refused input, the horizontal one at the settling value. Said once, the same way the transformation lesson says it: the number inside, x − 3, puts the vertical line at +3, the opposite of its sign; the number outside, +2, puts the horizontal line at 2, as written. A table shows the same two facts: a missing or blank row at x = 3, and outputs that close in on 2 as x gets large.

**Read.** "For which input is f(x) = 5": a backward question; the answer is an x, and never the refused one. "Which rule matches": read the two dashed lines, then test one point.

**The example (find the input).** f(x) = 3/(x − 3) + 2, x ≠ 3. For which input is f(x) = 5? Choices: 3; 4; 7; −4.
(1) Rule out first: 3 is refused, so it dims alone. (2) Reverse the chain from 5: subtract 2, 3/(x − 3) = 3. (3) Three over what is three? One: x − 3 = 1. (4) Add 3: x = 4. (5) Answer 4. (6) Forward: 3/(4 − 3) + 2 = 5 ✓.

**Second example (match the table).** Choices: 6/(x − 3) − 1; 6/(x + 3) + 1; 6(x − 3) + 1; 6/(x − 3) + 1.
(1) The linear rule dims at a glance: its outputs would climb steadily, and the table's do not. (2) The blank at x = 3 says the denominator is x − 3, so 6/(x + 3) + 1 dims. (3) The settling value: outputs approaching 1 for large x says +1, so −1 dims. (4) Test one row in the survivor and read the match aloud. The graph variant is the same three reads on the two dashed lines, then the marked point to confirm the numerator: for the dashed lines x = 1 and y = 1 and a marked point, 3/(x − 1) + 1.

**Fast.** Backward: undo the added number, then ask "the numerator over what gives this?", then undo the inside. Match: dashed lines first (inside opposite, outside as written), then one point.

**Sense.** The input is near the refused value when the output is far from the settling value: 5 is 3 above 2, so x is close to 3; 4 is.

**Check.** Substitute the chosen input; substitute one table row into the chosen rule.

**Line.** "The vertical dashed line is the refused input; the horizontal one is where the outputs settle."

**Trap.** Choosing 3, the refused input, as the answer: it dims first with its reason. Putting the vertical line at −3 for x − 3: the chain zeros the inside on the board.

**Kit.** Dashed `vline` and `hline` asymptotes on a rational `plot`; a `table` cell drawn as a blank for the refused input.

**Writer.** Strongest for the first wave, because three readings share one screenplay; after family 18 lands, a cheaper model can take it from that family's concept.

---

## Graphical equation solving (`graphical-equation-solving`, HSA.REI.D.11)

### `graphical-solution-table` — Where f(x) = g(x) from a table: exactly, in a bracket, or to the nearest tenth

**First:** the HSA.REI.C.7 link is thin (a line and a parabola, but solved by table, not algebraically); the type serves D.11. Three resolutions of one idea; the nearest-tenth case contains the other two, so it is the full example.

**Standard.** HSA.REI.D.11: "find the solutions approximately, e.g., ... make tables of values, or find successive approximations," and "Explain why the x-coordinates of the points where the graphs ... intersect are the solutions of the equation f(x) = g(x)."

**Foundations first.** The cross: two graphs, teal f and violet g, a dot where they meet; at that x the two heights are the same, so that x makes f(x) = g(x) true. The answer is the x; the shared height is just what the two sides equal. The table beside the graph is the graphs read at chosen inputs; a live third column, f − g, tells which graph is on top at each row (positive: f above). Where that sign changes between two rows, the graphs crossed between those inputs. Where it is zero in a row, that input is a solution exactly. Then the refinement the standard names: a finer table inside the bracket; testing the halfway input tells which half holds the crossing. Said plainly: "the end with the smaller difference" usually agrees and sometimes does not, so it is never the method.

**Read.** "For which input x": the answer is an x, and a choice beginning y = is never it. "Between which consecutive inputs": two neighboring rows. "To the nearest tenth": one end of the bracket, found by testing the midpoint.

**The example.** f(x) = x² − 5, g(x) = 3x − 2; the table brackets a solution between x = −0.8 and x = −0.7. Nearest tenth? Choices: −0.8; −0.9; −0.7; −0.6.
(1) Rule out: −0.9 and −0.6 are outside the bracket; dim together. (2) The two rows: f(−0.8) = −4.36, g(−0.8) = −4.40, f above by 0.04; f(−0.7) = −4.51, g(−0.7) = −4.10, g above by 0.41. The sign of f − g changed: the crossing is inside. The graph zooms to this stretch and shows the two curves crossing once. (3) Test the midpoint: f(−0.75) = −4.4375, g(−0.75) = −4.25, g above. So at −0.75 the order is already the right-hand row's order: the crossing is between −0.8 and −0.75, the left half. (4) The left half rounds to −0.8. Answer −0.8.

**Quick case (exact row, and a touch).** f(x) = x² − 2, g(x) = 2x − 3: in the row x = 1 both outputs are −1; the solution is x = 1. "y = −1" dims first: the question asks for an x. One beat worth having: here f − g is zero at x = 1 and positive on both sides; the graphs touch without crossing, so a zero row is a solution even when no sign changes. The bracket case is the main example's step (2) alone: f(x) = x² − 1, g(x) = −4x + 2, g above at x = 0, f above at x = 1: between 0 and 1.

**Fast.** Compute f − g per row. A zero is a solution; a sign change brackets one; test the midpoint to pick the nearer tenth.

**Sense.** The crossing is on the picture at about −0.8; the exact root (3 − √21)/2 ≈ −0.79 agrees.

**Check.** f(−0.8) and g(−0.8) differ by only 0.04: nearly equal, as the ends of a crossing should be.

**Line.** "Where the graphs cross the outputs are equal; the answer is the x."

**Trap.** Giving the shared output as the solution: the drop to the x axis is gold, and the y choice dims with its reason. Picking the nearer end by the smaller difference without testing: the midpoint is always tested, and said to be why.

**Kit.** `table` `diff` column live; `view` zoom into the bracket with the midpoint `vline`; `link` row to crossing dot; `cross` with the drop.

**Writer.** Strongest: the "why the x" explanation and the successive-approximation idea are the lesson, and the touch case needs judgment.

### `rational-abs-solution-count` — Count the solutions of a fraction equation against an absolute value by counting crossings

**First:** the catalog gives this type no standard; it is HSA.REI.D.11 (rational and absolute value cases). Five of six variants answer 1; the lesson's main example is the variant answering 3, because it is the one that exercises counting on both sides of the asymptote, and the answer-1 variant with the whole left side ruled out is the quick case.

**Standard.** HSA.REI.D.11: "Explain why the x-coordinates of the points where the graphs ... intersect are the solutions ... Include cases where f(x) and/or g(x) are ... rational, absolute value."

**Foundations first.** The cross, from the type above, in one line: a meeting point is a solution, so count the dots. Then the two shapes, built from their rules. The fraction a/(x + 3): refused at x = −3, so the graph is two branches split by that vertical dashed line, each settling toward the horizontal dashed line (y = 0 here, y = k when +k is added). The absolute value |x − 1| − 2: a V with its corner where the inside is zero, x = 1, lowered by 2 to (1, −2), arms rising at slope 1. The counting habit: look at each side of the vertical dashed line separately, because the far branch is the one eyes skip.

**Read.** "How many solutions": a count, so the choices are small whole numbers. At a glance: if any dot is visible, 0 is gone; on a side where one graph stays entirely above the other, that side contributes nothing.

**The example.** The graphs of y = −6/(x + 3) and y = |x − 1| − 2 are shown. How many solutions does −6/(x + 3) = |x − 1| − 2 have? Choices: 3; 0; 4; 2.
(1) 0 dims: the graphs visibly meet. (2) Right of the dashed line x = −3: the fraction is negative and climbs toward 0; the V comes down from height 2 at x = −3 to its corner (1, −2), then rises. The fraction starts far below the V and is above it at x = 1 (−1.5 against −2): one crossing on the way down, dotted. Then the V climbs past the fraction again (at x = 3 the V is at 0, the fraction at −1): a second dot. (3) Left of x = −3: the fraction is positive, huge near the line and falling toward 0; the V's left arm climbs leftward (3 at x = −4, 4 at x = −5). At x = −4 the fraction (6) is above the V; at x = −5 (3) it is below: one dot. (4) Three dots, three drops to the x axis in gold. Answer 3.

**Quick case (a side ruled out).** y = 3/x − 1 against y = |x| + 3: left of x = 0 the fraction stays below its settling line −1 and the V never dips below 3, so they cannot meet there; right of 0 the fraction falls from very high through the rising V once. One solution. Three beats.

**Fast.** Count on each side of the vertical dashed line; a side where the fraction's whole branch sits on one side of a horizontal line the V never crosses gives zero.

**Sense.** Each dot has an x; the three here are near −4.6, 0.6 and 1.7, all on the picture.

**Check.** The method's own: split the absolute value into its two arms and solve each against the fraction. The right arm gives x² = 3, x = √3 (−√3 is not on that arm, so it is thrown out); the left arm gives x² + 4x − 3 = 0, x = −2 ± √7, both on that arm. Three, as counted.

**Line.** "Count the dots, one side of the dashed line at a time."

**Trap.** Forgetting the branch on the far side of the asymptote and answering 2: the count is done side by side, and the far dot is drawn with its drop. Calling a near miss a touch where the fraction dives near the dashed line: the kit places the dots exactly, and the voice says a touch counts only when the graphs truly share a point.

**Kit.** `meet` points between a rational `plot` and a piecewise absolute-value `plot`; dashed asymptotes; the `cases` board for the check.

**Writer.** Strongest: the side-by-side counting and the rejected root in the check need reasoning a checker cannot verify.