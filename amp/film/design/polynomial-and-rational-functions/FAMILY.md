# Polynomial and rational functions, Algebra 2 to precalculus: family design

Six skills, 19 problem types (`polynomial-division` 5, `polynomial-zeros` 7, `polynomial-behavior` 3, `rational-function-behavior` 2, `fundamental-theorem-algebra` 1, `complex-factorization` 1). Planning sources: the catalog and the generated examples, read against the exact text of HSA.APR.B.2, B.3, D.6, HSF.IF.B.4, C.7, HSN.CN.C.7, C.8, C.9. This design covers the family's idea, picture, habits, tools, seam, misfilings and pilot. Per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

**A polynomial is a product of simple factors, and its graph is the product of their heights.** Each factor (x − a) is a tilted line that is zero at a, below the axis to its left and above it to its right. Pick any x, multiply the factors' heights there, and you have the polynomial's height there. Everything in this family is a consequence of that one sentence:

- a **zero** is where some factor is zero;
- the graph **crosses** the axis at a zero if an odd number of factors vanish there and **touches** if an even number do, because odd flips the sign and even does not;
- **far away** every factor is huge with the sign of x, so only the leading term is left, and the two ends of the graph are the two ends of c·xⁿ;
- **dividing** p(x) by (x − a) asks whether (x − a) is one of the factors; the leftover, the remainder, is p(a), the graph's height at a, so remainder 0 means the graph is on the axis there;
- a factor in a **denominator** does the same things upside down: where it is zero the height blows up (a vertical asymptote) unless the numerator shares the factor, in which case the point is simply missing (a hole); far away the two leading terms fight, and their ratio is the far-away height;
- over the **complex numbers** the factoring never stops short: a degree-n polynomial is exactly n linear factors, so it has n zeros counting repeats, and the ones the real graph cannot show come in mirror pairs.

A learner who can read a factored form as "zeros, how the graph meets the axis at each, and where the ends go", and who knows that the remainder is a height, owns the family. The picture that makes it permanent is the **zero line**: the x-axis with the zeros marked, a sign in every gap, and the rough curve drawn through. That is the scratch-paper sketch for two thirds of the 19 types.

### The foundations, in the order they are built

Each later lesson stands on the earlier ones and says so in one line ("you know a product is zero when a factor is").

1. **Zero, root, x-intercept: three names for one thing.** (A1, family 15; restated here first.) A zero of f is an x with f(x) = 0; it solves the equation f(x) = 0; the graph meets the x-axis there. A product is zero exactly when a factor is zero, so the zeros of (x + 7)(x² − 36) are read off one factor at a time: −7, −6, 6. **The factor says where it is zero: x + 2 is zero at negative two.**

2. **A factor is a line that changes sign at its zero.** (A2) (x − a) is negative left of a, positive right of a. A product's sign is the product of its factors' signs, so the polynomial changes sign where a factor does. Defined here: **sign chart**, the signs of p in the gaps between its zeros.

3. **Multiplicity: odd flips, even doesn't.** (A2) (x − a)² is never negative: it touches the axis at a and turns back. (x − a)³ flips but flattens. The exponent on a factor is the **multiplicity** of its zero: odd crosses, even touches. This decides every sign chart, every inequality, and every "which equation could the graph show".

4. **Far away, only the leading term matters.** (A2 to PC) For big |x|, c·xⁿ dwarfs every other term, so the ends of the graph are the ends of c·xⁿ. The **right end tells the sign** (rises: c > 0; falls: c < 0, whatever the degree); the **degree tells the left end** (even: same as the right; odd: opposite). In factored form the degree is the sum of the exponents and c is the product of the numbers out front.

5. **The degree counts the zeros and bounds the turns.** (A2 to PC) n factors means n zeros counting multiplicity (over the complex numbers, exactly n: foundation 9), and at most n − 1 turning points. A touch counts twice toward the degree.

6. **Division is the factor test, and the remainder is the height.** (A2) p(x) = (x − a)·q(x) + R; put in x = a and the first term dies: p(a) = R. So the remainder on dividing by x − a is p(a), with no division at all; remainder 0 means p(a) = 0, (a, 0) is on the graph, and x − a is a factor. The quotient q is the rest of p with that factor pulled out: a cubic becomes a quadratic you can finish. **Why divide:** to pull out a factor you have found and leave something smaller, and to find a factor by testing numbers.

7. **Whole part plus leftover over the divisor.** (A2, from family 7.) 17 = 5·3 + 2, so 17/5 = 3 + 2/5, never 3 + 2. Likewise p(x)/(x + 3) = q(x) + R/(x + 3). Long division of polynomials is the grade-4 layout with x in place of 10: divide the first term, multiply back, subtract, bring down. Synthetic division is the same arithmetic with the x's left out, and it always works when the divisor is x − a, which is every divisor in this family; the number in the box is a, the divisor's zero, the same number you would plug in.

8. **A bottom zero is an asymptote unless it cancels, then it is a hole.** (PC) Where the denominator is zero and the numerator is not, dividing by something tiny gives something huge: a **vertical asymptote**, a dashed line the graph runs along and never reaches, and the function has no value there. Where numerator and denominator share a factor it cancels, the reduced function has a value, and the graph has a **hole**: one missing point. Both x's are out of the **domain**. Far away the leading terms fight: top degree smaller gives y = 0, equal gives leading over leading, top bigger gives no horizontal asymptote.

9. **Over the complex numbers every polynomial factors all the way.** (PC) x² + 18 has no real zero, but it is (x + 3√2 i)(x − 3√2 i). A quadratic whose graph misses the axis still has two zeros, a ± bi and a − bi, mirror images across the real axis; their shared real part is the parabola's axis of symmetry. A degree-n polynomial with real coefficients has n roots counting multiplicity, real ones on the axis and nonreal ones in conjugate pairs. **The fundamental theorem of algebra** is the sentence "every polynomial of degree n has exactly n complex roots, counting repeats".

### What this family takes, and from whom

| From | What (named in one line, never retaught) |
|---|---|
| 15 Quadratics | zero product property; factoring, including by grouping; completing the square; the quadratic formula and a ± bi |
| 12 Expressions | multiplying factors out (the area model), like terms, the degree and leading term of an expanded polynomial |
| 7 Multiplication and division | division with a remainder, 17 = 5·3 + 2, and the long-division layout (`longdiv`) |
| 13 Functions and the plane | f(a) is the height at a; increasing and decreasing; the graph as every (x, f(x)); a piecewise rule |
| 4 Exponents | even powers are never negative, odd ones keep the sign; the highest power wins for big x |
| 3 and 11 The number line and inequalities | a solution set as a shaded stretch with filled or hollow ends; interval notation and brackets |
| 5 Complex numbers | i² = −1, the conjugate, the complex plane with equal scales |
| 17 Radical and rational equations | a denominator may not be zero: the domain |

It gives to precalculus and calculus readiness: limits written as "x → 1⁻", continuity, and the reading of any graph by its zeros, ends and forbidden points.

---

## 2. The visual language: the zero line under the graph, and a probe that multiplies

Two pictures the curriculum already owns, P7 (the graph) and P3 (the number line as the x-axis), plus the board's division layout and family 5's complex plane. Nothing new in kind; three new motions.

### The parts

- **The graph** (P7): numbered axes, the polynomial or rational function plotted in teal. The x and y axes may carry different scales, as the app's own graphs do, and both are always numbered. The view is chosen so each zero reads: a touch is visibly tangent to the axis, a cross visibly passes through, and the ends leave the card in the direction the leading term says. Geometry is never stretched; graphs may be.
- **Factor lines**: each linear factor drawn as its own thin blue line through (a, 0) with slope 1; a squared factor as a thin blue parabola touching at a (visibly never below the axis); a cubed factor as a thin blue cubic flattening through a. Their TeX rides beside them. They are what the polynomial is made of, and the student sees that the teal curve is zero exactly where some blue line is.
- **The zero line**: the x-axis itself (or a line aligned with it below the graph when the card is crowded). Each zero is a filled dot with its factor written under it, exponent included, (x + 2)². Each gap carries a sign: + in teal, − in rust, just above the axis. For an inequality, the solution is shaded along the line with filled ends for ≤ and ≥ and hollow ends for < and >, and a callout writes the interval notation as the shading grows, union by union. For a rational function the same line carries a dashed blue vertical stroke at each asymptote and a hollow dot at each hole.
- **The division layout** (board): the standard long-division layout of family 7 with terms aligned by degree, and the synthetic table (the box number, the coefficient row, the multiply row, the sum row). The remainder is written in gold because it is the thing being looked at.
- **The complex plane** (family 5's, equal scales, Re and Im labeled): roots as dots; a real root on the axis, a conjugate pair mirrored across it with a dashed vertical through their shared real part. Beside it, on the same card, the real graph with the same vertical line as the parabola's axis of symmetry.

### Color means one thing each

- **teal**: the function p itself: its graph, its expression, its quotient; and a plus sign on the zero line.
- **rust**: negative: a minus sign on the zero line, a negative factor value, an end that falls.
- **blue**: the divisor or denominator: a factor's own line, the (x − a) under test, the dashed vertical asymptote, the ring of a hole.
- **violet**: the far-away stand-in: the graph of the leading term c·xⁿ, the dashed horizontal asymptote, the ratio of leading terms.
- **gold**: the one thing being looked at now: the probe, the word in the question that says what is asked ("remainder", "touches", "horizontal asymptote", "least zero"), the remainder in the layout, the choice being proved. One gold thing at a time.
- **muted**: factor lines after their point is made, choices that have been ruled out, the dimmed board during a recap.

### The motions, and what each one proves

- **Probe** (foundations 2, 3, 6, 8): a gold vertical line at x = t that glides along the axis. A strip along the top of the card holds one tag per factor showing its sign (or its value) at t, and a result tag with their product (or quotient). The dot on the teal curve rides the probe at height p(t). Glide across a simple zero: one tag flips, the result flips, the dot crosses. Glide across a double zero: two tags flip, the result does not, the dot touches and turns back. Park the probe at x = a: the result tag is p(a), and it lights gold together with the remainder in the division layout: **the remainder is the height.** For a rational function the result tag is a quotient: near an asymptote the denominator tag shrinks toward 0 while the numerator does not and the result grows past the card; at a hole both tags shrink together, the result settles on a number, and the dot is hollow.
- **Pull back** (foundation 4): the view zooms out. The teal graph and the violet graph of its leading term, different near the origin, merge until they cannot be told apart; the lower terms have shrunk to nothing. For a rational function the teal graph flattens onto the violet horizontal line of the leading-term ratio. **Far away, only the leading term matters.**
- **Build** (foundation 5, the standard's "construct a rough graph"): the student's sketch drawn live. The zeros drop onto the line with their factors under them. The right end's arrow is drawn from the leading sign. Then a walk leftward: the sign of each gap fills in, flipping at an odd zero and holding at an even one, and the curve is stroked through, crossing or touching as it goes. No heights are claimed; the lesson says "rough" means shape, not size. Then the true graph slides in over the sketch and agrees in shape.
- **Collapse** (foundation 7): the long-division layout's x's fade and the coefficients slide into the synthetic table, so the student sees that the table is the same arithmetic. The box number is the divisor's zero, written in blue and said aloud as the number you would plug in.
- **Mirror** (foundation 9): on the complex plane a nonreal root appears and its conjugate flips across the real axis onto the dashed line through their real part; beside it the parabola, whose vertex sits above the axis and whose axis of symmetry is that same line. The zeros the real graph cannot show are the pair.
- **Dim** (every multiple choice): the ruled-out choices fade to muted together, in one beat, with the one reason said aloud. Nothing is struck out one by one.

### What the student sketches on scratch paper

For zeros, multiplicity, end behavior, graph matching and inequalities: a line, the zeros with exponents, a sign in each gap, an arrow at each end, the rough curve. For division: the synthetic table, four numbers. For a rational function: the same line with a dashed stroke at each bottom zero, a hollow dot where a factor cancelled, and the two degrees written side by side for the horizontal asymptote. For complex roots: the sum-and-product check written in one line.

---

## 3. How lessons in this family go

The five moves of the place-value family carry over unchanged: **read** the problem exactly as the app shows it, the asked word in gold, and say what the answer must look like before any work; **at a glance** name what is known with no work; the **sure fast way**, on the picture; **sense**; **check**, and for multiple choice **rule out** together, then prove the one that remains. At this level the foundation is most of the lesson: once the probe and the zero line are understood, the problems are reading. Pace: one idea per beat, plain words then the picture, a pause after each key idea, the motion finished before the voice moves on. A type with several sub-questions under one name (`rational-function-features`, `complex-quadratic-factors`, `polynomial-root-count`) gets a short "why" shot before each sub-question's example, never one long opening.

### Read: what the answer must look like

- A **remainder** is a number; a **quotient** of a cubic by a linear is a quadratic (the degree drops by one); the form asked by APR.D.6 is q(x) + R/(x − a), with the remainder *over the divisor*.
- **Zeros** of a factored product: one per linear factor, sign flipped; a difference of squares gives two; a factor of x gives 0; (x² + 3) gives none that is real. A repeated zero is listed once but counts twice toward the degree.
- The **solution of a polynomial inequality** is a union of intervals whose endpoints are the zeros; brackets are square at a zero only for ≤ or ≥, and ∞ always takes a round bracket.
- **End behavior** is two directions; **a horizontal asymptote** is y = a number; **vertical asymptotes** are x = the bottom zeros that survive cancelling; the **domain** excludes every bottom zero, cancelled or not.
- A **conjugate** keeps the real part and flips the sign of the i part; a **root count** is the degree.

### At a glance

- The remainder of p ÷ (x − a) is p(a). Nothing to divide. Dividing by x + 2 means a = −2.
- The degree, from the highest exponent present (2x³ − 5x⁴ + 6 − 2x² has degree 4) or the sum of the exponents in factored form (−2x²(x − 1)³ has degree 5), tells the number of zeros with repeats and whether the ends match (even) or oppose (odd). The sign of the leading coefficient, the product of the numbers out front, tells the right end.
- On a shown graph: the right end tells the sign; each place the curve meets the axis is a zero, a touch is an even exponent, a cross an odd one.
- For a rational function with factored top and bottom: cancel first; what is left in the bottom is asymptotes, what cancelled is holes; compare the two degrees for the far-away height, and for equal degrees read the two leading coefficients, constants out front included (3/2, not 1).
- For a quadratic with no real zeros: the real part of the roots is the axis of symmetry, −b/2a, before any formula.

### The sure fast ways (each one always works)

- **Remainder by plugging in**: p(a). Taught as the method, with the division once, side by side, so the student sees why the number from the layout and the height agree.
- **Quotient by synthetic division** when the divisor is x − a (every divisor the app generates), derived from long division by the collapse so it is not a trick. Long division stays as the method that works for any divisor.
- **Sign chart by the walk**: the far-right sign is the leading sign; walk left; flip at each odd zero, hold at each even one. No test points needed, though one test point is the check.
- **Rule from a graph**: write a factor for each zero, square it where the curve touches, take the sign from the right end, and confirm with the y-intercept (plug x = 0).
- **End behavior**: the leading term alone; the right end from its sign, the left end from its degree.
- **Asymptote or hole**: cancel, then read. **Horizontal asymptote**: top degree smaller, y = 0; equal, leading over leading; bigger, none.
- **One-sided behavior at a jump**: the left piece for x → 1⁻, the right piece for x → 1⁺, each evaluated at 1; at an asymptote, the sign of each factor just left and just right; at a hole, both sides give the reduced function's value.
- **Factor a sum of squares**: x² + k = (x + √k i)(x − √k i), the radical simplified. **Solve a quadratic with nonreal roots**: complete the square (family 15), (x + 5)² = −2 gives x = −5 ± √2 i.

### Sense, then check

- Sense: the degree and the picture agree (a cubic cannot have four zeros or three turns); a remainder is small compared with p's coefficients only by luck, so sense here is the sign of p(a) against the graph's side of the axis; a horizontal asymptote is roughly p(1000)/q(1000) in the head: 3·1000²/2·1000² is about 3/2.
- Check a remainder by plugging in, or multiply back (x − a)q(x) + R and compare the constant term: (−a)·q(0) + R must equal p(0). Check zeros by plugging one in: a factor dies. Check a rule from a graph with the y-intercept's sign. Check an inequality with one test point in one chosen interval. Check an asymptote by plugging x = 1.01 and seeing the size. Check a factorization over the complex numbers by multiplying back, or, for a monic quadratic, by the roots' sum (−b) and product (c): (−5 + √2 i) + (−5 − √2 i) = −10 and (−5)² + 2 = 27.

### Ruling out nonsense fast

Multiple-choice decoys in this family are the misconceptions, so each is named as it dims. Six glances kill most choice sets:

1. **Count.** A quotient of the wrong degree, a root count that is not the degree, a factored form whose exponents do not add to the graph's degree: gone.
2. **Sign of the zero.** Any choice with (x + 2) for a graph that is zero at 2, or evaluating at 4 for a divisor of x + 4: gone together, with the line "x + 2 is zero at negative two".
3. **The right end.** Rises means a positive leading coefficient. One glance halves a graph-matching set.
4. **Plug in zero.** The y-intercept's sign tests every candidate rule.
5. **Plug in a.** p(a) tests every candidate remainder; half the quotient choices die with it.
6. **Multiply back.** Two lines test any factorization; (x + 18i)(x − 18i) is x² + 324.

And three nonsense forms that dim at once with no arithmetic: a "remainder" written without the divisor under it (x² + 4x − 2 − 9); a conjugate that swaps the real and imaginary parts (3 − 2i for −2 + 3i); a horizontal asymptote y = 0 when the degrees are equal.

### Realistic misconceptions, and the picture that ends each

These are what students at this level actually get wrong; the generated decoy sets contain these misconceptions.

| What they do | Why they do it | What makes it impossible |
|---|---|---|
| Read (x + 2) as a zero at +2; evaluate p(2) for a divisor of x + 2; put +3 in the synthetic box for x + 3 (the decoy x² + 10x + 40 + 105/(x + 3) is exactly this) | The number in the factor and the zero have opposite signs, and the eye takes the number | The blue factor line (x + 2) visibly crosses at −2; the box number is said aloud as "where the divisor is zero" every time |
| Subtract in synthetic division | Long division subtracts | The collapse shows the sign already changed when the box number is a: the table adds |
| Write the remainder alone: q(x) + R, or "R" as the answer to a form question | Grade-4 habit of "3 R 2" | 17/5 = 3 + 2/5 said once; the form q + R/(x − a) written in the standard's own shape |
| Call a touch multiplicity 3, or count a touch as one zero toward the degree | "Repeated" is heard, not seen | The probe: two tags flip at a double zero and the product does not; the blue parabola never dips below the axis |
| "Negative leading coefficient means it falls on both sides"; read the sign from the left end | Memorized without parity | Pull back: −x³ rises on the left; the right end alone tells the sign, said as the rule |
| Take the degree from the first term written, or from the number of terms (the decoys 7 and 9 for degree 8) | Reading order | The leading term is found and circled gold before anything else, even when it is written second |
| Flip the sign at a double zero in an inequality; put square brackets on a strict inequality; include the zero of (x − 1)² when the inequality is strict | Alternating signs mechanically; "the zero is on the boundary so it counts" | The walk holds at the even zero; the shaded stretch has a hollow dot at 1 and the callout writes (−1, 1) ∪ (1, ∞) |
| Call a top zero a vertical asymptote; include the hole's x in the domain; call the hole an asymptote | Any special x is "an asymptote" | The probe: at a top zero the result is 0, at a bottom zero it grows off the card, at a hole it settles on a number but the dot is hollow; the domain is read off the zero line's dashed strokes and hollow dots |
| Write the horizontal asymptote upside down (2/3), or ignore the constants out front | The ratio is copied from wherever the eye lands | The pull-back lands the graph on the violet line labeled with the two leading terms written as a fraction, top over bottom |
| Plug x = 1 into the x ≥ 1 piece for the left-hand approach, because "1 belongs to that piece" | The value at 1 is confused with the approach from the left | Two dots glide toward x = 1 from each side along their own pieces with live readouts; the left one stops at 0, the right at −5 |
| √−18 = 18i, or 3√2 without the i, or (x + 3√2 i)² | Difference-of-squares habit; the radical half-done | Multiply back on the board: x² − 18, x² + 324, x² + 6√2 i x − 18; only one gives x² + 18 |

### The lines to remember

- "The factor says where it is zero: x + 2 is zero at negative two."
- "The remainder is the height."
- "Odd flips, even doesn't."
- "Far away, only the leading term matters."
- "The right end tells the sign; the degree tells the left end."
- "Whole part, plus the leftover over the divisor."
- "Bottom zero: asymptote, unless it cancels: then a hole."
- "Same degree: leading over leading."
- "Degree n, n roots, counting repeats. The ones you can't see come in mirror pairs."

A cast (teacher and student) fits the inequality and "which statement is true" lessons well, where the student's first wrong thought (flipping at the double zero, reading the sign from the left end) is the real one and the untangling is the lesson.

---

## 4. Tools to build

What exists and serves as is: `axes` (numbered, with `xrange`/`yrange` so two panels share one card, as the sine lesson did), `plot` (breaks at asymptotes by itself, `from`/`to` for a piecewise piece), a `dot` on a plot with `glide` and `@y` readouts, `view` for the pull-back, `seg` with `extend` and `dash` for a dashed line, `flip` over a line for the conjugate mirror, `vector.ts` and the complex-plane conventions from `complex-plane-forms`, `label` with TeX, the board with wrapped choice pills, the `problem`/`write`/`answer`/`watch`/`recap` set, `--dry` math checking. Specified elsewhere and not yet built: `dim` (place value), `longdiv` (family 7's roadmap, build order 3), interval shading on an axis and dashed asymptotes with open holes (the P7 extension list), interval-notation callout (P3 list).

This family needs four additions and one shared build.

### 4.1 `probe`: the gold line that multiplies

```json
{ "id": "pr", "probe": true, "x": -3, "of": ["f1", "f2", "f3"], "show": "sign",
  "result": "product", "on": "p" }
```

- A gold vertical line at x. `of` lists the factor plots whose values at x are tagged; `show: "sign"` tags + (teal) or − (rust), `"value"` tags the number. `result` tags the product (or `"quotient"`, with the first listed plots as the numerator and `"over": [...]` as the denominator) in the result's own color. `on` names the plot whose dot rides the probe at its height.
- Tags sit in a strip along the top of the card, each under its factor's TeX, in the order given; the result tag at the right end. A tag that changes sign pulses once as the probe passes the zero.
- Actions: `{"do":"glide","point":"pr","x":2.5}` (the probe is a point); `{"do":"show","target":"pr.tag.2"}`, `pr.result`, `pr.dot`.
- For a quotient whose denominator tags reach 0 at the target x while the numerator does not, the result tag's number grows as the probe nears and the dot leaves the card; when both reach 0 the result reads the reduced function's value and the dot is drawn hollow. The kit computes; the author paces.

### 4.2 `signline`: the zero line (extends the specified `numberline`)

```json
{ "id": "zl", "signline": true, "on": "ax",
  "zeros": [{ "at": -4, "mult": 1 }, { "at": -1, "mult": 1 }, { "at": 1, "mult": 2 }],
  "lead": "+", "degree": 4 }
```

- `on` lays it directly on a figure's x-axis, or `at` places it below the graph on its own line with the same scale. Each zero is a filled dot with its factor TeX under it (`tex` overrides); `mult` sets the exponent shown.
- Actions: `drop` (zeros fall onto the line one at a time on their words), `end` (the right or left arrow from `lead` and `degree`), `walk` (fill the gap signs from the right, flipping at odd zeros and holding at even ones, one gap per beat or all on one word with `dur`), `sketch` (stroke the rough curve through, crossing or touching as `mult` says), `shade` with `"where": ">"|"≥"|"<"|"≤"` (the solution stretch, filled or hollow ends by the inequality, open at ∞), `notation` (a callout that writes the interval notation union by union as the shading grows). For a rational function: `asymptote` at an x (dashed blue stroke) and `hole` at an x (hollow dot).
- Parts: `zl.zero.1`, `zl.sign.2` (a gap), `zl.shade`, `zl.notation`, `zl.end.right`.
- Shares its line, ticks and labels with `numberline` so the child's grade-3 picture is the same object.

### 4.3 `longdiv` with a polynomial mode and the synthetic table (shared with family 7)

```json
{ "do": "longdiv", "id": "d1", "dividend": "x^3+7x^2+10x-15", "divisor": "x+3", "layout": "long" }
```

- `layout: "long"` draws the standard layout with terms aligned by degree, a missing term shown as a muted 0·x; `"synthetic"` draws the box with the divisor's zero in blue, the coefficient row, the multiply row and the sum row. The kit computes every term, product, difference and bring-down; the author paces with `{"do":"step","of":"d1","at":"word","write":"word"}` one step per beat, as `column` does for `stack`. `--dry` reports how many steps.
- `{"do":"collapse","of":"d1","at":"word"}`: the long layout's x's fade and its coefficients slide into the synthetic table beside it, which then runs. The two layouts show the same numbers, so a lesson can run the long one once and the table afterward.
- The remainder is written in gold. `{"do":"form","of":"d1"}` writes p(x) = (x + 3)·q(x) + R under the layout, then the fraction form q(x) + R/(x + 3) on a second word.
- Numeric mode (whole and decimal division, the point straight up) is family 7's and 2's; build the component once with all three so it is never rebuilt.

### 4.4 Plot additions

- `"holes": [2]` on a `plot` of the reduced expression: a hollow dot at the reduced value and the curve lifted there.
- `"dash": true` on a `plot` (the violet stand-in curve).
- `{ "id": "va", "asymptote": "x=1", "ink": "blue", "tex": "x=1" }` and `"y=3/2"` in violet: a dashed line through the view with its label in clear space; `draw` grows it from the axis.
- Piecewise: `"ends": ["closed", "open"]` on a plot with `from`/`to` draws the end dots the problem's figure shows.

### 4.5 `dim` for choices (place value's 4.6, shared)

`{"do":"dim","choices":[1,3]}`: a set of choices fades to muted together in one beat. Every multiple-choice type in this family (14 of 19) needs it.

### Build order

1. `dim` (shared; blocks every multiple-choice lesson in the curriculum).
2. `probe`, with the factor-line conventions: pilot lesson 1.
3. `signline` on `numberline`: pilot lesson 2.
4. `longdiv` with polynomial mode, synthetic table and collapse: pilot lesson 3, and families 7 and 2.
5. Plot additions (holes, dashed stand-in, asymptote lines, piecewise ends): pilot lesson 4.
6. Nothing new for the complex lessons: two `axes` panels, `dot`, `flip`, `seg` dashed, as `complex-plane-forms` already does.

Each piece is built to the depth the pilot lesson asks; later lessons extend.

---

## 5. The seam: who writes what

As in the curriculum plan: a cheaper model takes a job only after a blind test, and only once the kit it needs exists. Expected outcome, with reasons.

**Strongest writer (the screenplay is the design: a motion must be staged, or the quality is in the reasoning).**

- `zero-multiplicity`, `repeated-zero-rule`, `polynomial-graph-match`: the first of these builds the probe, the factor lines and the right-end rule from nothing; a weak author describes the flip instead of staging it. Once the first is approved, the other two are the same lesson on a different graph and can move down.
- `polynomial-inequality-solve`: the walk with multiplicity, the brackets, the notation callout; every one of its decoys is a misconception that must be named at the moment the picture answers it.
- `rational-function-features`: six questions under one name (vertical asymptotes, hole, horizontal asymptote, x-intercepts, y-intercept, domain); a reading lesson with the blow-up and the hole staged on the probe, and the pull-back for the horizontal asymptote.
- `one-sided-behavior-choice`: three cases (jump, asymptote, hole) and new notation (x → 1⁻) that must be defined in plain words; the two gliding readouts are the lesson.
- `cubic-graph-statement`: "which statement is true"; the quality is the reasoning about each statement against the graph, which no checker can verify.
- `remainder-zero-graph`: short, but it is the family's hinge, division meeting the graph; the probe parked at a and the layout's remainder lighting together must be exact.
- `complex-quadratic-factors`: three cases (factor a sum of squares, solve, build a quadratic from roots), the mirror, and the axis-of-symmetry insight.

**Capable cheaper model, from a concept and the complete kit (one method, one component with named actions, `--dry` catches most slips).**

- `remainder-theorem` (find k), `remainder-steps` (slots: evaluate p(a)), `polynomial-quotient` and `cubic-quotient-remainder` (pace `longdiv` exactly as `stack` is paced; the sign-of-the-box trap is one `watch` card), `zeros-from-factors`, `zeros-of-factored-product`, `sat-entry-polynomial-zeros`, `rg-polynomial-zeros-forms` (grouping once, product once), `polynomial-behavior-description` (after the pull-back has been staged and approved in pilot 1, this is "find the leading term, right end, degree"), `polynomial-root-count` (two short cases: the degree; the conjugate).

The review of every lesson stays with a model at least as strong as the writer, and an independent reviewer watches the pilot in full and samples later lessons.

---

## 6. What is misfiled, badly conceived or off grade, and what the standards ask that the app never practices

> Base and trick cases are wanted in the app; a flag here means a weak choice for a lesson's main example or a catalog fix, never a reason to drop a problem.

**Filing.** The brief's header places this family under Arc D (measurement and geometry); the curriculum plan has it under Arc C (functions), which is right.

**Types.**

- `one-sided-behavior-choice` is filed under `rational-function-behavior` (HSF.IF.C.7d), but both generated examples are piecewise linear functions with a jump (HSF.IF.C.7b, piecewise-defined, which family 13 owns at Algebra 1), and the "x → 1⁻" notation is calculus readiness, not in any Common Core clause. If the type also generates asymptote and hole cases, as its description says, it is a mixed type of three kinds; the lesson must work one of each. Proposal: keep the asymptote and hole kinds here and move the jump kind to `piecewise-functions`, or rename the skill to say it teaches one-sided behavior rather than rational functions.
- `polynomial-inequality-solve` has no linked standard. Polynomial inequalities are not a Common Core clause of their own; the nearest are HSA.APR.B.3 (zeros to a rough graph) and HSF.IF.B.4 ("intervals where the function is ... positive, or negative"). Link both.
- `repeated-zero-rule` (A2, cubic from a graph with sign and a double zero) and `polynomial-graph-match` (PC, any small degree, leading coefficient ±1) are one type at two grades; `zero-multiplicity` overlaps both. Keep the types, but one concept serves the three and the catalog should say so.
- `polynomial-quotient` and `cubic-quotient-remainder` are the same division in two answer forms (quotient and remainder; q + R/(x − a)). One method; the second lesson is brief. `polynomial-quotient`'s "Use the layout to divide" refers to a figure the problem text does not show; the lesson must use the app's exact layout (`facts.ts` names it), and if that layout is the synthetic table the lesson derives it from long division first.
- `remainder-steps`: the slots group the terms in a way the prompt does not state (3x³ − 3x² summed, then −2x + 5; one variant's first slot is prefilled). The app should label the slots ("x = ", "the first two terms", ...), and the lesson must mirror the slot structure exactly.
- `sat-entry-polynomial-zeros`: "sum of all real zeros" with a repeated zero counted once should say "distinct" in the template when a repeated factor appears, or the convention is a trap of the template's making.
- `polynomial-behavior-description`: the description promises behavior at each zero and the number of turning points, the examples show only end behavior; if the other kinds exist the type is mixed and gets one example of each.
- `polynomial-root-count`: two unrelated kinds (count roots; name the forced conjugate); fine as two short cases. The conjugate kind is linked to HSN.CN.A.3 (conjugates for moduli and quotients), a stretch; it is a consequence of real coefficients and belongs with C.9.
- `zeros-from-factors`, `zero-multiplicity`, `repeated-zero-rule` are linked to HSF.BF.A.1, a modeling standard ("from a context"); none has a context. The right links are HSA.APR.B.3 and HSF.IF.C.7c.
- Grade: `polynomial-behavior` at precalculus is defensible, though HSF.IF.C.7c (polynomial graphs, zeros, end behavior) sits in Algebra 2 in the traditional pathway; no change needed. The limit notation in `one-sided-behavior-choice` is above every linked standard; acceptable at precalculus if the lesson defines it.

**Standards clauses the app never practices.**

- HSA.APR.B.3: "use the zeros to construct a rough graph of the function". The app asks the reverse (an equation from a graph) four ways and never asks for a graph from a factored polynomial, by sketch or by choice. The lessons stage the build anyway; the app lacks the problem.
- HSA.APR.D.6: "using inspection, long division, or ... a computer algebra system", with "the degree of r(x) less than the degree of b(x)". Every divisor the app generates is x − a; there is no quadratic divisor (where the remainder is linear), no inspection case such as (x² − 1)/(x − 1), and no CAS.
- HSF.IF.C.7d: "graph rational functions, identifying zeros and asymptotes ... and showing end behavior". Features are asked; no rational graph is ever drawn, matched or sketched, and end behavior is asked only as a horizontal asymptote.
- HSN.CN.C.9: "show that it is true for quadratic polynomials". Never asked: no problem has the student argue that every quadratic has exactly two complex roots.
- HSN.CN.C.8: "extend polynomial identities to the complex numbers". Only x² + k is factored; the complete factorization of a quartic such as x⁴ − 16 into four linear factors, or of a cubic with a known real zero, never appears.
- HSF.IF.B.4: relative maximums and minimums, and symmetry, are never asked of a polynomial (turning points at most as a count); increasing intervals appear once, in `cubic-graph-statement`.

---

## 7. The pilot

Five types, covering every foundation, every new tool, both grade bands and every answer shape (multiple choice with a graph, interval notation, a form, a feature list, a complex factorization) in one sitting.

| # | Type | Grade | Why first |
|---|---|---|---|
| 1 | `zero-multiplicity` | A2 | The picture is born here: factor lines, the probe flipping one tag at a simple zero and two at a double one, the pull-back for "the right end tells the sign". Builds `probe` and `dim`. If this is not beautiful, nothing after it will be. |
| 2 | `polynomial-inequality-solve` | A2 | The scratch-paper sketch of the family drawn live: zeros drop, the walk flips at odd and holds at even, the shaded stretch with hollow and filled ends, the notation callout. Every decoy is a real misconception. Builds `signline`. |
| 3 | `cubic-quotient-remainder` | A2 | Long division as the grade-4 layout, the collapse to the synthetic table, the box number as the divisor's zero, the probe parked at a with the remainder lighting as the height, the form q + R/(x + 3) as 17/5 = 3 + 2/5. Builds `longdiv`; `polynomial-quotient` and `remainder-zero-graph` follow at once from it. |
| 4 | `rational-function-features` | PC | The probe divides: blow-up at a bottom zero, a hole where a factor cancels, the pull-back onto the leading-term ratio; six questions read off one zero line. The mixed reading lesson of the family. Builds the plot additions. |
| 5 | `complex-quadratic-factors` | PC | The family's end: the parabola that misses the axis and the mirror pair on the complex plane sharing its axis of symmetry; x² + 18 factored; the sum-and-product check. No new kit, so it also tests whether the existing complex-plane tools carry a second family. |

If the five land, the second wave is `remainder-zero-graph`, `polynomial-behavior-description`, `polynomial-quotient`, `one-sided-behavior-choice` and `polynomial-root-count`, which complete the tool set and open the seam test for the cheaper writers.
