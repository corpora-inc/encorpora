# Exponential models: ten concepts (part 2)

Written from the family design. Each stands on the foundations numbered there (F1 to F11) and uses the step table with arrows, the staircase, the timeline with factor arcs, or the graph. Two things to say before the types:

- **`exponential-target-time` is off grade.** It needs a logarithm, which this catalog teaches in Algebra 2 and Common Core places in Algebra II (HSF.LE.A.4). The concept below is written so the lesson can stand alone (ln defined in one line as "how many steps of e"), but the honest fix is to move the type to `exponential-equations` or make the Algebra 1 path reach `logarithm-value` first.
- **`compound-growth` is a mixed type** (six wordings, four kinds of question). Its concept teaches reading, as the authoring guide asks, and proposes a split.

The shared opening every lesson here uses, in a few beats, never re-taught: a quantity that multiplies by the same factor each step; value = start × factor^(arrows); count the arrows, not the cells.

---

#### `exponential-domain-range` — Domain and range of an exponential, bare or in a story. F6.

**Standard.** HSF.IF.B.5: "Relate the domain of a function to its graph and, where applicable, to the quantitative relationship it describes." HSF.IF.A.1 for the words domain and range.

**Foundations first.** Define *domain*: every input the rule accepts. *Range*: every output it can give. Then build the fact the type lives on, on the staircase of 4^x: bars 1, 4, 16, 64 to the right; to the left 1/4, 1/16, 1/64, each a quarter of the last, never nothing. The never-zero push-in: the camera moves toward the baseline and the bar is still there, a quarter as tall. "Multiplying positives never gives zero, and never gives a negative." Then two moves the rule can make: a number in front stretches or flips the staircase (−3 hangs it below the baseline); a number added lifts the whole thing (+1 lifts the baseline to the dashed line y = 1). The line the staircase hugs and never touches is the *asymptote*.

**Read.** "Domain and range, as inequalities." At a glance: the domain is every real number unless the story limits it (t ≥ 0 when the count starts at zero); the range's boundary is the added number k; the sign of a says which side; the boundary is never reached unless the story's start sits on it.

**The example.** f(x) = −3(4)^x + 1, with its four choices. (1) Domain: any number can be an exponent, negative or fraction included; −∞ < x < ∞. (2) Table 4^x at x = −2, −1, 0, 1, 2: 1/16, 1/4, 1, 4, 16; all positive. (3) Times −3: all negative; the staircase flips below the baseline. (4) Plus 1: everything lifted by one; the baseline becomes the dashed line y = 1; every value is below it. (5) Can y be 1? Only if 4^x is 0; never. Range y < 1. The real plot of −3·4^x + 1 drawn with the dashed asymptote; f(0) = −2 marked.

**Second example, the model** (a different case: the story closes an end). P(t) = 100(0.5)^t, t from 0. Domain t ≥ 0, since the first count is at 0 and nothing before it is modeled. Range: at t = 0 the value is 100, really reached, so ≤ 100; halving never reaches 0, so 0 < P. 0 < P ≤ 100. One beat for the growth model 50·2^t: the start 50 is the smallest value and is reached: P ≥ 50, no top.

**Fast.** Domain: all reals, or t ≥ 0 if the count starts at 0. Range: k is the boundary; a > 0 above, a < 0 below; strict, unless the start is in the domain, then the start is included.

**Sense.** One value tells the side: f(0) = −2 is below 1.

**Check.** A value near the boundary: f(−5) = −3/1024 + 1 ≈ 0.997, below 1 and not 1.

**Rule out.** "Domain x > 0" confuses the input with the output: 4^(−2) is fine; dims. "y ≤ 1" claims the boundary is reached; dims. The two left differ by the sign of a: −3 flips. For the model, "−∞ < x < ∞" is the bare function's domain in the wrong letter; "P > 0" ignores that the count began at 100 and falls; "P ≥ 100" has the direction wrong.

**Line.** "Multiplying positives never gives zero."

**Trap.** y ≥ 0 or y ≤ 1: the belief that the staircase reaches its floor (misconception 9); and ignoring the sign of a (y > 1 for −3·4^x + 1). The push-in that never arrives, and the flip, make both impossible.

**Kit.** `plot` must take `-3*4^x+1` and `100*0.5^x`; a dashed `seg` with `extend` for the asymptote; `view` pushing in with a live `@y` readout of a point gliding left. The staircase with left-of-zero bars needs `steps` to draw fractional heights to scale.

**Writer.** Strongest. The lesson is the staged push-in and the judgment of when the start is included; a weak author states the rule instead of showing why.

---

#### `compound-growth` — Interest compounded n times a year, continuously, and changing the time unit. F4.

**Badly conceived as one type.** Four kinds under one name: (a) a balance from A = P(1 + r/n)^(nt); (b) a balance from A = Pe^(rt), which is Algebra 2 material; (c) a per-period percent turned into a yearly percent; (d) reading or rewriting the exponent's time unit (1.20^(m/4) for quarters; 1.035^(2t) as "7% compounded twice a year"). Propose three types: bank compounding (a, d); continuous compounding with e (b); unit conversion of factors and percents (c, the quarters rewrite). Until then this is a mixed lesson that teaches reading.

**Standard.** HSA.SSE.B.3c: "Use the properties of exponents to transform expressions for exponential functions"; HSF.IF.C.8b: "identify percent rate of change in functions such as ... y = (1.01)^(12t)."

**Foundations first.** The timeline for one year with one ×1.05 arc. Define *compounded quarterly*: the bank pays interest four times a year, each time 5%/4 = 1.25% on the balance at that moment. Refine the arc into four ×1.0125 arcs. The end lands a hair above the ×1.05 mark: 1.0125^4 = 1.0509. Say once, plainly: this is the bank's cut, not the exact cut (the exact quarter factor would be the fourth root, 1.0123); the bank's cut gives a little more than the stated rate, and that is why "compounded" beats simple. Then the formula read off the picture: n arcs a year for t years is nt arcs, each ×(1 + r/n). For continuous: a table of (1 + 1/n)^n for n = 1, 4, 12, 365, a million: 2, 2.4414, 2.6130, 2.7146, 2.71828. The arcs blur and the end settles: e ≈ 2.71828, defined here. At rate r the year's factor settles at e^r.

**Read.** Four facts: the start, the yearly rate, how often, how long. "Compounded quarterly" gold: the year is cut in four. "Continuously": cut without end, use e. For a percent question: the stretch asked for (one year) against the stretch given (one month).

**The example (a).** 8,000 at 5%, quarterly, 3 years. (1) Timeline: 3 years, 12 quarters, ×1.0125 on each. (2) Rule out first: 14,367 is nearly double in three years, what ×1.05 twelve times would do (the full yearly rate every quarter); 8,304 is less than one year's interest (only three quarters counted); 9,200 is exactly simple interest, 8,000 + 3 × 400. All three dim together. (3) 8,000 × 1.0125^12 = 8,000 × 1.1608 = 9,286.04 → 9,286. (4) Sense: a little above simple 9,200, and above yearly compounding 9,261.

**Example (b), brief.** 3,000 at 5% continuously for 10 years: 3,000 e^(0.5) = 3,000 × 1.6487 = 4,946. Rule out 4,500 (simple), 4,887 (3,000 × 1.05^10: yearly compounding, and more cuts always give more), 3,002 (barely moved).

**Example (c), brief.** 1.5% a month, each on the last month: twelve ×1.015 arcs make one yearly arc of 1.015^12 = 1.1956: 19.6%. Rule out together: anything at or below 18% (twelve 1.5s added), and 119.6% is the factor read as a percent.

**Two readings (d), one beat each.** 1.20^t with t in years, m quarters since the start: t = m/4, so 1.20^(m/4); test m = 4: one year, ×1.20. 1500(1.035)^(2t): the exponent says twice a year; 1.035 = 1 + 0.07/2, the bank's 7% split in two; the true yearly growth is 1.035² = 1.0712, which is why the statement says "7% annual" and not "7% a year of growth".

**Fast.** Bank: (1 + r/n)^(nt). Continuous: e^(rt). Period to year: raise the period factor to the periods in a year, then subtract 1. Year to period in the exact sense: root; in the bank's sense: r/n.

**Sense.** Compound beats simple from the second period on; more cuts, more money; continuous is the most.

**Check.** The estimate against simple interest, and the answer's size against the choices' size.

**Line.** "Finer steps, same total: the root. The bank's cut is r over n, and it pays a little more."

**Trap.** 1.05 applied every quarter (misconception 13), and adding the monthly percent twelve times (3). The refine with its fixed end makes the first impossible; the staircase of growing slabs the second.

**Kit.** `numberline` `refine` with a mark for the simple-interest end so the hair of difference is visible; `table` for the e table; the board math check must know e and accept ≈ with stated rounding.

**Writer.** Strongest. Reading four kinds, defining e, and the bank's convention against the root are judgment, not method.

---

#### `sat-fn-exponential-choice` — Choose the model: start, factor, step. F2, F3, F4.

**Standard.** HSF.LE.A.2: "Construct linear and exponential functions ... given a description of a relationship, or two input-output pairs (include reading these from a table)."

**Foundations first.** The three things to find, each gold as it is read: *start* (the amount at the first count, and whether the count begins at 0 or 1), *factor* (given, hidden in a percent, or found by dividing neighbors), *step* (one unit, or a stretch like "every 5 years"). Then the rule: start × factor^(arrows). Draw the step table from the example's numbers before the first choice is looked at.

**Read.** "Which function": only start, factor and exponent can differ among the choices, so the question is really "which exponent counts the arrows correctly". At a glance: the model must give the start at the first count and the second value one step later.

**The example.** 300 residents in 2000, doubles every 5 years. (1) Timeline: ticks at 0, 5, 10, 15 years, a ×2 arc over each five-year stretch. (2) Arrows from 0 to t: t = 5 is one, t = 10 is two, so t years hold t/5 arrows. (3) P(t) = 300 · 2^(t/5). (4) Start check: t = 0, 2^0 = 1, 300. One-step check: t = 5, 2^1, 600; the second bar is twice the first. (5) Rule out together with the one-step test at t = 5: 2^(5t) gives 2^25, doubled twenty-five times in five years; 2^t gives 2^5 = 32 times, doubling every year; 10^t is the 2 and the 5 glued together. Only t/5 gives 600.

**Second example, brief** (counting from 1): 128 teams in round 1, half each round. Step table x = 1, 2, 3: 128, 64, 32; round x is x − 1 arrows from round 1. f(x) = 128(1/2)^(x−1). Start check at x = 1: 128(1/2)^0 = 128; (1/2)^x gives 64, (1/2)^(x+1) gives 32, 2^(x−1) grows. Three dim on the start check alone.

**Quick cases, the factor hidden three ways**, two or three beats each: a table 1000, 1060, 1123.6: divide neighbors, 1.06 and 1.06, so 1000 · 1.06^x (0.06 is the lost share, 0.94 the wrong direction, 1 + 0.06x adds instead of multiplies). "Increases by 250% of the number at the start of the hour": the percent bar extends to 350%, factor 3.5, not 2.5 (250 cells become 875, not 625). Two values four days apart, 4 and 1024: the quotient 256 is four arrows, so the factor is the fourth root, 4 (256 is the whole stretch's factor, not one day's).

**Fast.** Find start, factor, step; write start × factor^(t/step), or ^(x − 1) when counted from 1; test the first count and one step.

**Sense.** Doubling three times in fifteen years is ×8: 2,400 in 2015.

**Check.** The start check and the one-step check, against the picture.

**Rule out.** The start check (first count must give the start) kills every off-by-one; the one-step check kills every misplaced stretch (5t, t); direction kills 0.94 for growth; a factor equal to the percent (0.06) would leave six percent; a linear form has no factor at all.

**Line.** "Count the arrows, not the cells. Test the first count, then one step."

**Trap.** 2^(5t) (misconception 4) and (1/2)^x for round x (1). The timeline shows five years holding one arc; the step table shows round 1 holding zero arrows.

**Kit.** `steps` and the timeline arcs with `span`; `dim`.

**Writer.** A capable cheaper model, once pilot lessons 1 and 3 have shown the step table and the timeline; every case here is the method with its decoy named.

---

#### `sat-entry-fn-exponential` — Walk the arrows backward, or find the factor and take one more step. F1, F2.

**Standard.** HSF.LE.B.5: "Interpret the parameters in a linear or exponential function in terms of a context"; HSF.IF.A.2: "evaluate functions for inputs in their domains."

**Foundations first.** The step table with arrows, filled from the end given. Going forward along an arrow multiplies; going backward divides by the same factor. Three equal arrows that together make ×8 are each ×2: the factor for one arrow is the root. Said with the bars: a bar one arrow back is the current bar shrunk by the factor.

**Read.** "How many at the start": the later amount is given; the start is the amount at 0 arrows. Count the arrows first: time passed ÷ one period. For f(3) = 56 with f(x) = 7 · b^x: three arrows carry 7 to 56, so b³ = 8; f(4) is one arrow further than 56.

**The example.** Doubles every 5 years; after 15 years, 232 members. (1) Timeline 0, 5, 10, 15 with ×2 arcs: three arrows, not fifteen. (2) Fill from the right: 232; back one arrow, ÷2, 116; back again, 58; back again, 29. The bars shrink to the left. (3) Start 29. (4) Forward check: 29 × 2 × 2 × 2 = 232.

**Second example** (a different case: the factor is unknown). f(x) = 7 · b^x, f(3) = 56. (1) 7 · b³ = 56, so b³ = 8: three equal arrows make ×8. (2) 2 · 2 · 2 = 8, so b = 2; the arcs fill in ×2. (3) f(4) is one arrow past 56: 56 × 2 = 112. No need to start over from 7; the picture says the next bar is the factor times this one.

**Fast.** Start = later ÷ factor^(arrows). Unknown factor: output ÷ a, then the root matching the arrow count. Next output = known output × factor.

**Sense.** A growing quantity's start is less than its later value; 232 ÷ 8 is about 30. f(4) is a bit more than 56, not many times more.

**Check.** Multiply forward from the start, one arrow at a time, and land on the given value.

**Line.** "Backward is divide. Same factor, same arrows."

**Trap.** Dividing by factor × arrows (232 ÷ 6) or by the factor once; using 15 as the arrow count. The timeline holds exactly three ×2 arcs in fifteen years, and division happens once per arc on screen.

**Kit.** `steps` filling cells right to left, with `step` reversed (bars shrinking from a sliding copy); nothing else.

**Writer.** Capable cheaper model; one picture, one method, the trap in the arrow count.

---

#### `graph-exponential-points` — Place three points on y = a · b^x. F2, F6.

**Standard.** HSF.IF.C.7e: "Graph exponential ... functions, showing intercepts and end behavior."

**Foundations first.** b^0 = 1, so at x = 0 the rule gives a: the y-intercept is the start (family 4's fact, said in one line). One step right multiplies y by b; one step left divides by b (a negative exponent is a step backward, never a negative value). The step table drawn under the axes with its ×b arcs; the bar tops lifted onto the grid as dots, the hand-off from staircase to graph. Then the curve through them, because this is a function of every x, not a sequence.

**Read.** "Place 3 points": any three true pairs that land on grid crossings. At a glance: (0, a) is always one; b > 1 climbs to the right; b < 1 falls to the right and climbs to the left.

**The example.** y = 9 · (1/3)^x. (1) x = 0: 9 · 1 = 9; dot at (0, 9). (2) Step right, ×1/3: (1, 3); right again: (2, 1); right again would be 1/3, not on a grid crossing, stop. (3) Step left, ÷(1/3) = ×3: (−1, 27), off the grid; stop. (4) Points (0, 9), (1, 3), (2, 1); the curve drawn through, hugging the x-axis to the right and never touching it.

**Second example, brief** (a different case: the grid points are to the left). y = (1/2)^x. x = 0: 1. Right: 1/2, no. Left: ÷(1/2) is ×2: (−1, 2), (−2, 4), (−3, 8). Any three of these four. Say that the answer key lists one triple; the checker must accept any three correct grid points, or the lesson contradicts the app.

**Fast.** Start at (0, a); multiply to the right, divide to the left; keep the integer pairs that fit.

**Sense.** The curve never crosses the x-axis; b < 1 falls to the right; the dots lie on one smooth bend, no dot out of line.

**Check.** Put one x back in the rule: 9 · (1/3)² = 9/9 = 1.

**Line.** "b to the zero is one, so the start is the y-intercept."

**Trap.** (0, 0) or (0, b) at x = 0, from b^0 read as 0 or as b; and a negative exponent read as a negative y ((1/2)^(−1) as −1/2). The step table's first cell is a, visibly, and the leftward bars stand above the baseline.

**Kit.** `steps` with `points` onto an `axes` part sharing the baseline; the app's own coordinate-plane figure for the placed points; `plot` through them.

**Writer.** Capable cheaper model.

---

#### `exponential-time-scale` — The factor over its stretch, and the factor for one unit. F4.

**Standard.** HSA.SSE.B.3c: "the expression 1.15^t can be rewritten as (1.15^(1/12))^(12t) ≈ 1.012^(12t)"; HSF.IF.C.8b: "identify percent rate of change in functions such as ... y = (1.2)^(t/10)".

**Foundations first.** Read b^(t/d) on the timeline: ticks every d years, one ×b arc over each stretch, t/d arrows in t years. "Every d years, multiplied by b", and the start is a, at t = 0. Then the refine, the one motion this type is about: one ×b arc over d years splits into d equal arcs with the ends held fixed. d equal factors that multiply to b are each the dth root, b^(1/d), because (b^(1/d))^d = b. Finer steps, same total. So a · b^(t/d) = a · (b^(1/d))^t, and the one-year factor is b^(1/d).

**Read.** Three wordings, one reading: the base is the factor, the denominator of the exponent is the stretch, a is the start. "Equivalent model": the root inside, t outside. "Which statement": the factor belongs to the stretch, not to one year. "Yearly factor to four decimals": the dth root on a calculator.

**The example.** P(t) = 120(2)^(t/4). (1) Start 120; every 4 years, ×2; the timeline with ×2 arcs on 0–4, 4–8, 8–12. (2) Refine the first arc into four: each ×2^(1/4) ≈ 1.1892; the end still sits at ×2. About 19% a year, not 50%. (3) P(t) = 120(2^(1/4))^t; at t = 4, (2^(1/4))^4 = 2, matching. (4) The statement form read off the same picture: "Every 4 years, the population is multiplied by 2."

**Quick case** (the decimal stretch, a calculator beat): 190(2)^(t/4.5): 2^(1/4.5) = 1.1665; check 1.1665^4.5 ≈ 2. 60(1/2)^(t/2.5): (1/2)^(1/2.5) = 0.7579, below 1, since the model shrinks.

**Fast.** One-unit factor = b^(1/d). Statement: "every d units, times b." Start = a.

**Sense.** A yearly factor for doubling in four years is between 1 and 2 and nearer 1 (1.5 a year would give 1.5^4 ≈ 5, far too much). A shrinking model's yearly factor is below 1.

**Check.** Raise the yearly factor to the stretch and get b back.

**Rule out.** "120 + 2^(t/4)": adding, not multiplying; dims. "2^(4t)": doubles four times a year (test t = 4: 2^16); "2^t": doubles every year. "Initial population 300": the factor mistaken for the start. "Changes by 2 individuals": a difference, not a factor. For the decimals: a yearly factor below 1 for a growing model, or above 1 for a shrinking one, dims; 2/4.5 = 0.4444 is a division, not a root; 1.1487 is 2^(1/5), the stretch rounded to 5.

**Line.** "Finer steps, same total: the factor for one piece is the root."

**Trap.** Reading the stretch's percent as yearly (misconception 10), and b/d or b^d for the yearly factor. The refine with fixed ends: four equal arcs must multiply back to 2.

**Kit.** `numberline` `refine` with the root label shown once and "×4"; the math check must accept 2^(1/4) ≈ 1.1892.

**Writer.** Strongest for whichever of this and `growth-model-rewrite` is written first, since the refine is born there; the other can go to a cheaper model from the finished picture.

---

#### `exponential-parameters-blanks` — Start, direction, percent, read from a · b^t. F3.

**Standard.** HSF.LE.B.5: "Interpret the parameters in a linear or exponential function in terms of a context"; HSF.IF.C.8b: "identify percent rate of change ... and classify them as representing exponential growth or decay."

**Foundations first.** a is the value at t = 0, because b^0 = 1. b is compared with 1: above grows, between 0 and 1 shrinks. The percent bar, once: a bar for 100% of this year's value; b = 0.85 keeps 85% and the lost 15% slides off in rust; b = 1.25 reaches past 100% by a gold 25%. The percent in the sentence is the distance from b to 1, as a percent, never b itself.

**Read.** The sentence has three blanks: start, grows or shrinks, percent. At a glance: a is the number in front; b < 1 is "shrinks"; the percent is |b − 1| × 100.

**The example.** V(t) = 1,200(0.85)^t. (1) Start: 1,200. (2) 0.85 is below 1: shrinks. (3) 1 − 0.85 = 0.15: 15% a year. The bar cut at 85, the 15 leaving. (4) Staircase: 1,200, 1,020, 867; each bar 85% of the last.

**Quick case** (growth, and the decimal that reads wrong): P(t) = 200(1.2)^t: 1.2 is 1.20, twenty percent, not two; grows 20%; 200, 240, 288.

**Fast.** a; b against 1; |b − 1| as a percent.

**Sense.** 15% of 1,200 is 180, and 1,200 − 180 = 1,020 = 1,200 × 0.85.

**Check.** Write the factor back from the percent: lose 15%, keep 85%, 0.85.

**Line.** "A percent is a factor: keep what is left."

**Trap.** "Shrinks by 85%" (the kept share read as the lost share, misconception 2), and 1.2 read as 2% or 1.05 as 50%. The cut bar names the lost part; the factor is written as 1.20 on the board before the percent is read.

**Kit.** `bar` with a percent scale and `shade`; `steps` with `cut`. The facts output gives only letter keys for the blanks; the screenplay writer needs the rendered sentence and its option lists.

**Writer.** Capable cheaper model; a short lesson with one picture.

---

#### `exponential-initial-value` — The value at t = 0, including a shifted exponent. F2.

**Standard.** HSF.LE.B.5: "Interpret the parameters ... in terms of a context"; HSF.IF.A.2: "evaluate functions for inputs in their domains."

**Foundations first.** *Initial value*: the amount at t = 0, the first count. Put 0 in for t, work out the exponent, then the power, then multiply. Usually the exponent becomes 0 and b^0 = 1, so the initial value is a. The step table shows why: at t = 0 there are no arrows yet. But the exponent is read, not assumed: if it is t + 1, then at t = 0 one arrow has already been taken.

**Read.** "Initial value" gold. The answer is an amount (grams, people, dollars), never a factor. At a glance: if the exponent is plain t, the answer is a; if the exponent is shifted, compute it.

**The example.** C(t) = 200(0.5)^(t+1), grams in a pond. (1) t = 0: the exponent is 0 + 1 = 1. (2) 0.5^1 = 0.5. (3) 200 × 0.5 = 100 grams. (4) The step table with a muted column at t = −1 holding 200: the 200 is the value one step before the first count; at t = 0 one halving is already done; t = 1 gives 50. (5) Choices: 100.

**Quick case** (the plain exponent, where the definition is shown): V(t) = 200(1 + 0.2)^t: the factor is 1.2; t = 0 gives 1.2^0 = 1; 200 dollars. 240 is the value after one year; 1.2 and 0.2 are a factor and a rate, not dollars.

**Fast.** t = 0; evaluate the exponent; b to that; times a.

**Sense.** The initial value is an amount of the story's kind; numbers near 1 or below 1 cannot be a population or a sum of money.

**Check.** The formula at t = 0 on a calculator.

**Rule out.** Factors and rates (1.2, 0.2, 0.5) dim together: not amounts. The value after one step (240 = 200 × 1.2; 165 = 150 × 1.1) dims: that is t = 1. For the shifted exponent, 200 is the value one step before the count, and 201 reads the +1 as an addition.

**Line.** "t equals zero first; then read what the exponent is."

**Trap.** Taking a as the start always (200 for 200(0.5)^(t+1)). The muted t = −1 column shows where the 200 lives.

**Kit.** `steps` with a column left of the first count drawn muted; nothing else.

**Writer.** Capable cheaper model.

---

#### `exponential-target-time` — When does the model reach the target? F7, F8.

**Off grade** (see above). Written to stand alone, defining ln in one line.

**Standard.** HSF.LE.A.4: "For exponential models, express as a logarithm the solution to ab^(ct) = d where a, c, and d are numbers and the base b is 2, 10, or e; evaluate the logarithm using technology." Bases 1.2, 1.35 and 1.8 in the variants go past the clause's "2, 10, or e" and need ln b in the denominator.

**Foundations first.** The question is a step count: how many ×1.35 arrows carry 530 to 4770? First the bracket on the staircase: 1.35^7 ≈ 8.17 and 1.35^8 ≈ 11.03, and 4770 ÷ 530 = 9 sits between, so t is between 7 and 8. Then the tool that gives the exact count: ln N is "how many steps of e reach N" (the exponent e needs; "ln" is the log with base e). The one rule used: ln(b^t) = t · ln b, because t copies of b take t times the steps of one b (multiply the numbers, add the steps). So the exponent comes down.

**Read.** Set the model equal to the target. Three facts: start, base, target; the rounding asked. At a glance: the whole-step bracket from the staircase.

**The example.** 530 · 1.35^t = 4770, hours. (1) Divide both sides by 530: 1.35^t = 9. (2) Bracket: between 7 and 8 arrows. (3) ln of both sides: ln(1.35^t) = ln 9; t · ln 1.35 = ln 9. (4) t = ln 9 / ln 1.35 ≈ 2.1972 / 0.3001 ≈ 7.32 hours. (5) Check: 530 · 1.35^7.32 ≈ 4,770.

**Second example, brief** (base e, half the variants): 510 e^(0.08t) = 4670. Divide: e^(0.08t) = 9.157. ln of e to a power is the power itself: 0.08t = ln 9.157 = 2.2145. t = 2.2145 / 0.08 = 27.68 hours. One idea added: with base e nothing is divided by ln b; the rate is what multiplies t.

**Fast.** Divide by the start; ln both sides; divide by what multiplies t (ln b, or the rate for e); round at the end.

**Sense.** The bracket: 7 < t < 8 for the first; for the second, e^2 ≈ 7.4 and e^2.3 ≈ 10, so 0.08t ≈ 2.2, t ≈ 28.

**Check.** Put t back into the model and read the target.

**Line.** "A log asks: how many steps."

**Trap.** ln 4770 / ln 530 instead of ln(4770/530) (the quotient of logs for the log of a quotient, misconception 7's cousin), and rounding ln 1.35 to 0.3 before dividing. The lesson divides the amounts first, on the picture, so the log is taken of the step count's number; and the board carries four decimals until the last line. Note for the app: the intermediate steps are graded in ln only; base-10 logs (log 9 / log 1.35) give the same 7.32 and must be accepted; "3.2" to the nearest hundredth should read 3.20.

**Kit.** The board math check must know ln, e and ≈ with stated rounding; `steps` with bars passing a target line.

**Writer.** Capable cheaper model once `logarithm-value` exists; the method is complete above, and the math check catches the arithmetic.

---

#### `growth-model-rewrite` — A yearly factor as a monthly one; a model from a half-life. F4.

**Standard.** HSA.SSE.B.3c: "the expression 1.15^t can be rewritten as (1.15^(1/12))^(12t) ≈ 1.012^(12t) to reveal the approximate equivalent monthly interest rate"; HSF.LE.A.2 for the half-life model.

**Foundations first.** The refine on the timeline: one ×0.94 arc over a year, split into twelve equal arcs with the ends fixed. Twelve equal factors that multiply to 0.94 are each the twelfth root, 0.94^(1/12) ≈ 0.9949: about 0.51% lost a month, not 0.5%. t years is 12t months, so the monthly model counts 12t arrows of the monthly factor. Then the other direction of the same idea: a half-life is a stretch; t hours hold t/8 half-lives.

**Read.** "Equivalent" gold: the rewritten form must give the same value at every t; test one full year. "Shows the monthly factor": the root inside, 12t outside. For the half-life: start, factor 1/2, stretch h.

**The example.** V(t) = 120(0.94)^t, monthly form. (1) Refine: twelve ×0.94^(1/12) arcs in the year; the end still at 0.94. (2) V(t) = 120(0.94^(1/12))^(12t). (3) Test t = 1: (0.94^(1/12))^12 = 0.94. (4) Rule out together: (0.94^(1/12))^t has only one month's loss in a year; (0.94^12)^(12t) loses 144 months' worth in one; (1 − 0.06/12)^(12t) = 0.995^(12t) is the bank's cut, and 0.995^12 = 0.9416, a 5.84% yearly loss, not 6%: close, and not equivalent. The lesson says this number aloud; it is the realistic decoy.

**Second example** (the other direction: a stretch counted in arrows). 50 grams, half-life 8 hours. (1) Timeline 0, 8, 16, 24 with ×1/2 arcs: 50, 25, 12.5. (2) t hours hold t/8 arrows. (3) A(t) = 50(1/2)^(t/8). (4) Test t = 8: 25. Rule out: (1/2)^(8t) halves eight times an hour; (1 − 1/2)^t halves every hour; (1/8)^t puts the stretch in as the factor.

**Fast.** Monthly: (b^(1/12))^(12t). Half-life: start · (1/2)^(t/h). Test one full stretch.

**Sense.** The monthly factor is a hair below 1 for a 6% yearly loss; the half-life model gives half at t = h.

**Check.** One full year or one half-life in the chosen form returns the original factor.

**Line.** "Finer steps, same total: the factor for one piece is the root."

**Trap.** (1 − 0.06/12)^(12t) taken as equivalent to 0.94^t (misconception 13), and (1/2)^(8t) (4). The fixed-end refine: twelve equal factors must multiply back to 0.94, and 0.995 does not; eight hours hold one ×1/2 arc, so t hours hold t/8.

**Kit.** `numberline` `refine`; a mark on the timeline where 0.995^12 lands, a hair above 0.94, so "not equivalent" is seen; the math check must accept 0.94^(1/12) ≈ 0.9949 and 0.995^12 ≈ 0.9416.

**Writer.** Strongest, as the family design says: the bank's-cut decoy is reasoning the lesson must stage exactly. If `exponential-time-scale` has already built the refine, the half-life half could go to a cheaper model, but the lesson is one film and goes as a whole.
