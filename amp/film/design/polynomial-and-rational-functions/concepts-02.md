# Polynomial and rational functions, part 2: the nine remaining concepts

Written from the family design (part 1). Each concept names the foundations it stands on by number (F1 to F9 in the design), and the five moves (read, at a glance, fast, sense, check; rule out for choices) run in every one. Three catalog notes first, because they shape the lessons:

- `repeated-zero-rule`, `polynomial-graph-match` and `zero-multiplicity` are one lesson on three graphs. The concept below is written once under `repeated-zero-rule`; `polynomial-graph-match` lists only what differs.
- `polynomial-behavior-description`, `one-sided-behavior-choice`, `rational-function-features`, `polynomial-root-count` and `complex-quadratic-factors` are mixed types: several questions under one name. Each gets a short "why" shot before each kind's example, never one long opening, and the recap names each kind by what is asked.
- Three types are linked to standards they do not practice (HSF.BF.A.1 is a modeling standard; HSN.CN.A.3 is about moduli and quotients). The right links are given per type.

---

## Algebra 2: polynomial-zeros

### `zeros-of-factored-product` — Every zero of a product. F1, F2.

**Standard.** HSA.APR.B.3: "Identify zeros of polynomials when suitable factorizations are available." HSA.SSE.A.2 for the one rewrite the type needs: x² − k² = (x − k)(x + k). (HSA.APR.B.3's second clause, "construct a rough graph", is not asked; the lesson draws the graph anyway, because the graph is what makes the zeros mean something.)

**Foundations first.** (1) A *zero* of f is an x where f(x) = 0; it is where the graph meets the x-axis. Three names, one thing: zero, root, x-intercept. (2) A product is zero exactly when one of its factors is zero: 5 × 0 × 3 = 0, and nothing else makes it zero. Drawn: the factor (x + 7) as a thin blue line crossing the axis at −7, labeled; *the factor says where it is zero, and the sign is flipped*. (3) x² − 36 is a difference of squares: (x − 6)(x + 6), a blue parabola crossing at 6 and −6. It hides two zeros, never one. (4) The probe: a gold vertical line glides; a strip tags each factor's value at x and the product; the teal curve's dot rides at the product's height. Where any tag reads 0, the product reads 0 and the dot sits on the axis.

**Read.** "What are *all* the zeros" (gold): a list, as many as the degree. At a glance: (x + 7)(x² − 36) has degree 3, so three zeros, and x² − 36 is two of them.

**The example.** f(x) = (x + 7)(x² − 36); choices {−36, −7, 36}, {−6, 6, 7}, {−7, −6, 6}, {−6, 6}. Figure: axes x from −9 to 9, y stretched and numbered so the zeros read; the blue line x + 7, the blue parabola x² − 36, the teal cubic. (1) x + 7 = 0 at x = −7; the probe parks there: tag 0, product 0, dot on the axis. (2) x² − 36 = (x − 6)(x + 6): zero at 6 and at −6; the probe parks at each; the parabola visibly crosses twice. (3) Three zeros for degree 3. (4) {−7, −6, 6}.
*Quick second case* (a different case: a bare x and a number out front): f(x) = 2x(x² − 4). The factor x is zero at 0, the one students skip; 2 is never zero, so it adds nothing; x² − 4 gives ±2. {−2, 0, 2}. Three beats.

**Fast.** Each linear factor: flip the sign. x² − k²: ±k. A bare x: 0. A constant: nothing. Count the zeros against the degree.

**Sense.** The count equals the degree; the zeros are small numbers (±6), never the square (36).

**Check.** Plug one in: f(−7) = 0 · (49 − 36) = 0; a factor dies.

**Rule out.** Wrong count for the degree ({−6, 6} for a cubic): gone. A 36 or 49 in the list (the square, not its root): gone. A sign-flipped zero (7 for x + 7): gone. All three dim together: "wrong count, a square, a wrong sign".

**Line.** "A product is zero when a factor is zero. The factor says where: x plus seven is zero at negative seven."

**Trap.** Reading x² − 36 as "the zero is 36", or solving x² = 36 and keeping only 6. The blue parabola crosses the axis in two places, neither of them at 36.

**Kit.** `probe` in value mode, factor-line convention, `dim`. **Writer.** Capable cheaper model: one method, one component, every decoy named in the concept.

---

### `repeated-zero-rule` — A cubic's rule from its graph. F1, F3, F4.

**Standard.** Linked to HSF.BF.A.1 (modeling, "from a context"); there is no context. It serves HSF.IF.C.7c, "identifying zeros when suitable factorizations are available, and showing end behavior", read in reverse, and HSA.APR.B.3.

**Foundations first.** (1) A zero at r means a factor (x − r): a zero at 2 is (x − 2), a zero at −2 is (x + 2). The blue factor line crosses where its zero is. (2) *Multiplicity*, defined on the probe: at a simple zero one tag flips sign, so the product flips and the curve crosses; at (x − 2)² two tags flip, the product does not, and the curve touches the axis and turns back. The blue parabola (x − 2)² is visibly never below the axis. **Odd flips, even doesn't.** (3) The pull-back: far away the graph is its leading term. The right end falls when the number out front is negative, rises when positive, whatever the degree. **The right end tells the sign.**

**Read.** "Which equation *could* represent it": the equation is decided by three readings: where the zeros are, which one the graph touches, and which way the right end goes. At a glance: the zeros are 2 and 3, both positive, so any choice with (x + 2) or (x + 3) is gone; the right end falls, so a minus sign is needed.

**The example.** The app's graph: a cubic touching the axis at 2, crossing at 3, falling to the right, with the y-axis numbered; choices y = (x − 2)²(x − 3), y = −(x + 2)²(x + 3), y = −(x − 2)²(x − 3), y = −(x − 2)(x − 3)². (1) Zeros 2 and 3 drop onto the zero line under the graph; factors (x − 2), (x − 3) written under them, "sign flipped". (2) At 2 the curve touches: the probe glides across, two tags flip, the product holds; (x − 2)². At 3 it crosses: one tag flips; (x − 3). (3) The right end falls: − out front. (4) y = −(x − 2)²(x − 3). (5) Check at x = 0: −(4)(−3) = 12; the graph crosses the y-axis at 12, read off the figure.

**Fast.** Zeros to factors with the sign flipped; square the touch; sign from the right end; y-intercept to confirm.

**Sense.** Degree 2 + 1 = 3, a cubic, as the problem says; a negative cubic rises on the left, and the graph does.

**Check.** The y-intercept: plug x = 0 and compare with where the graph meets the y-axis.

**Rule out.** Zeros at −2, −3: gone. Positive out front for a graph that falls right: gone. Both dim together: "wrong zeros, wrong end". Of the two left, the square must sit on the touching zero; the probe at 2 decides.

**Line.** "Odd flips, even doesn't. The right end tells the sign."

**Trap.** Squaring the wrong zero (the decoy −(x − 2)(x − 3)²), and writing (x + 2) for a zero at 2. The probe's two-tag flip and the blue line through 2 end both.

**Kit.** The app's graph rebuilt on the kit's `axes` so the blue factor lines, `probe` and zero line can be overlaid (facts.ts gives the function); `dim`. **Writer.** Strongest for the first of the three sibling lessons (the flip must be staged, not described); once `zero-multiplicity` is approved, this and `polynomial-graph-match` are the same screenplay on a new graph and a cheaper model can write them.

---

## Precalculus: polynomial-behavior

### `polynomial-behavior-description` — Ends, zeros, and the most turns. Mixed: three kinds. F3, F4, F5.

**Standard.** HSF.IF.C.7c, "showing end behavior" and "identifying zeros"; HSF.IF.B.4, "end behavior". The turning-point bound is in no Common Core clause; it is standard precalculus and the lesson gives its reason, not just the rule.

**Badly conceived?** No, but mixed: end behavior from an expanded sum (3 variants), end behavior plus cross-or-touch at each zero from a factored form (2), and the greatest number of turning points (1). One example of each, each with its own short why.

**Foundations first.** (1) The *leading term*: the term with the highest power, wherever it is written; found and circled gold before anything else. In a product of factors the degree is the sum of the exponents and the number out front is the product of the numbers out front. (2) The pull-back: the teal graph and the violet dashed graph of its leading term differ near the origin, then the view zooms out and they merge. **Far away, only the leading term matters.** (3) So the ends are the ends of c·xⁿ: the right end rises if c > 0, falls if c < 0; the left end matches the right for even n and opposes it for odd n (x² and x³ drawn side by side). (4) Multiplicity (F3): odd exponent crosses, even touches; said in one line with the blue parabola. (5) A *turning point*: where the graph stops rising and starts falling, or the reverse. Why at most n − 1: a degree-n graph meets the axis at most n times, and between any two meetings it must turn once; the most turns a cubic can have is 2, drawn, and a fourth turn would need a fourth-degree term.

**Read.** Kind A: "end behavior" means two directions, left and right. Kind B: directions, then at each zero "crosses" or "touches". Kind C: "greatest number of turning points" is a count, one less than the degree. At a glance, kind A: even degree means the ends match, so half the choices are gone before the sign is read.

**Example A.** P(x) = 2x³ − 5x⁴ + 6 − 2x². (1) Highest power: x⁴; the leading term is −5x⁴, written second, circled gold. (2) Degree 4, even: both ends go the same way. (3) −5 is negative: the right end falls. (4) Both ends fall. Pull back: the teal quartic lands on the violet −5x⁴. Choice: "falls on both".
**Example B.** P(x) = −(x + 4)(x + 1)²(x − 2)². (1) Degree 1 + 2 + 2 = 5, odd: ends opposite. Out front: −1, negative: right falls, so left rises. (2) Zeros drop onto the line: −4 with exponent 1, −1 and 2 with exponent 2. (3) The build: right arrow down; walk left: negative right of 2; hold at 2 (even): negative; hold at −1: negative; flip at −4 (odd): positive, rising away to the left. The rough curve is stroked through, touching at 2 and −1, crossing at −4; then the true graph slides in and agrees. (4) "Rises left, falls right; crosses at −4; touches at −1 and 2."
**Quick case C.** −3x(x − 3)³: degree 1 + 3 = 4; at most 3 turning points. Three beats.

**Fast.** Leading term; its sign gives the right end; its degree gives the left end; each factor's exponent gives cross or touch; turns: degree minus one.

**Sense.** The rough curve from the walk has the ends the leading term says; if the walk and the ends disagree, a sign was misread.

**Check.** One test point: P(0) = −(4)(1)(4) = −16, negative, as the sign chart says between −1 and 2.

**Rule out.** Kind A: ends that oppose for an even degree, or match for an odd one: gone at once. Kind B: a choice that crosses at an even-exponent zero: gone. Kind C: the degree itself (4) is a turn count one too many: gone.

**Line.** "The right end tells the sign; the degree tells the left end."

**Trap.** Taking the degree from the first term written (2x³, giving "falls left, rises right", the decoy) or from the number of terms; and "negative means falls on both sides" (the decoy for the odd case). The gold circle on the true leading term, and −x³ drawn rising on the left, end both.

**Kit.** Violet dashed stand-in plot with `view` pull-back, `signline` with `drop`, `end`, `walk`, `sketch`; `dim`. **Writer.** Capable cheaper model once pilots 1 and 2 have staged the pull-back and the build; the three kinds are laid out above beat by beat.

---

### `polynomial-graph-match` — Factored form from a graph (any small degree). F1, F3, F4.

**Standard.** HSF.IF.C.7c and HSA.APR.B.3, as `repeated-zero-rule`. Same lesson; what differs is below.

**What differs.** The problem states the zeros are integers and the leading coefficient is 1 or −1, so exponents 1 and 2 and a bare ± are all that is needed; the lesson says so once ("simplest choices"). The decoy set adds a wrong-degree choice, so the first glance is the count: a touch counts twice toward the degree.

**The example.** The app's graph: a cubic touching at −2, crossing at 2, falling right, y-axis numbered; choices −(x + 2)(x − 2), (x + 2)²(x − 2), −(x + 2)²(x − 2), −(x + 2)(x − 2)². (1) Zeros −2 and 2 drop; factors (x + 2), (x − 2) under them, sign flipped. (2) Touch at −2: probe, two tags flip, product holds: (x + 2)². Cross at 2: (x − 2). (3) Right end falls: −. (4) P(x) = −(x + 2)²(x − 2). (5) Check: P(0) = −(4)(−2) = 8; the graph meets the y-axis at 8.

**Rule out.** Count first: a touch and a cross make degree at least 3, so the quadratic −(x + 2)(x − 2) is gone. Right end falls: (x + 2)²(x − 2) is gone. Both dim together. The square sits on the touching zero, −2, not 2.

**Trap.** Putting (x − 2)² for a touch at −2: the eye takes the 2 and forgets the flip. The blue parabola (x + 2)² sits on −2.

**Kit and writer.** As `repeated-zero-rule`; cheaper model once that lesson is approved.

---

### `cubic-graph-statement` — Which statement about a cubic's graph is true. F3, F4.

**Standard.** HSF.IF.C.7c (zeros, end behavior) and HSF.IF.B.4: "intervals where the function is increasing, decreasing", "end behavior". The notation "as x → ∞, f(x) → −∞" is in no clause; the lesson defines it.

**Foundations first.** Four readings of one graph, each defined on the picture before the problem. (1) *End behavior*: "as x → ∞" means "as x runs off to the right"; f(x) → −∞ means the graph falls off the bottom. Read the right end. (2) *Multiplicity from the shape*: x² and x³ drawn side by side at 0; both are flat there, but x² touches and turns back (even, multiplicity 2) and x³ flattens and goes *through* (odd, multiplicity 3). Flat alone does not tell; which side the graph leaves on does. The probe: at a double zero the dot comes down to the axis and goes back up the same side. (3) *Increasing on an interval*: moving right across that stretch of x, the graph goes up; decreasing, it goes down. Read between the turning points, on the x-axis, never "where the graph is positive". (4) A cubic has at most two turns (F5).

**Read.** "Which statement is true": each statement is a claim to test against the picture; three are false for a reason that can be seen. At a glance: the right end and the stretch from 0 to 2 are read in one look each.

**The example.** The app's graph: a cubic with a double zero at 0 (touching from below), a turning point at 2, a crossing at 3, rising right (the generator's example is f(x) = x²(x − 3) or its like); statements: "x = 0 is a zero of multiplicity 2", "as x → ∞, f(x) → −∞", "x = 0 is a zero of multiplicity 3", "f is increasing on (0, 2)". (1) Right end: it rises, so f(x) → +∞, not −∞; dims. (2) From x = 0 to x = 2 the graph goes down (read two heights off the numbered axis: f(1), f(2)); decreasing, not increasing; dims. The two dim together: "the right end rises; from 0 to 2 it falls". (3) Multiplicity at 0: the probe comes to the axis from below and leaves below; the graph does not cross; even; a touch with the simplest exponent is 2, and a cubic with another zero at 3 has no room for a triple at 0 (2 + 1 = 3). Multiplicity 3 dims. (4) "x = 0 is a zero of multiplicity 2" is proved: f(x) = x²(x − 3) has the right zeros, the right end, and f(0 ± a little) negative on both sides.

**Fast.** Right end; which way the graph goes across the named interval; touch or cross at the named zero. Three looks, no algebra.

**Sense.** The degree bounds everything: a cubic's multiplicities add to 3, so a double zero at 0 leaves exactly one more zero, and the graph shows one.

**Check.** Write the rule the readings imply, x²(x − 3), and confirm one height against the axis.

**Rule out.** Above: the end and the interval go first, at a glance; the multiplicity pair is the only one that needs the picture studied.

**Line.** "Flat at a zero is not enough: touch is even, through is odd."

**Trap.** "It's flat at 0, so multiplicity 3" (the decoy), and reading "increasing" as "above the axis". The x² / x³ pair, and the two heights read off the axis between 0 and 2.

**Kit.** The app's graph on kit `axes`, `probe` dot, `dim`; a cast fits (the student says "flat, so three"; the teacher glides the probe). **Writer.** Strongest: the quality is the reasoning about each statement, and a generated graph may vary which statement is true.

---

## Precalculus: rational-function-behavior

### `one-sided-behavior-choice` — What f approaches from each side. Mixed: jump, asymptote (and hole if generated). F8, with F2 for signs.

**Misfiled.** Filed under rational functions (HSF.IF.C.7d), but four of the six generated variants are piecewise linear with a jump (HSF.IF.C.7b, piecewise-defined, owned by family 13). The notation x → 1⁻ is calculus readiness, in no standard; acceptable at precalculus if defined. Proposal stands: move the jump kind to `piecewise-functions`, or rename the skill. The lesson as written works one example of each kind the app generates; the hole kind is in the description but was absent from the sampled variants, so it gets a short case only if `facts.ts` shows one.

**Foundations first.** (1) "x approaches 1 from the left" means x is 0.9, then 0.99, then 0.999: creeping up to 1, never reaching it. Written x → 1⁻; the little minus says *which side*, not that anything is negative. From the right: 1.1, 1.01, 1.001; x → 1⁺. (2) "f(x) → 0" means the heights settle toward 0; "f(x) → ∞" means they grow past any number. (3) The picture: two dots on the graph, one on each side, gliding toward x = 1 with live height readouts. What the readout settles on is the answer. (4) Why the two sides can differ: a piecewise function changes rule at 1, so each side follows its own line; at an asymptote the bottom shrinks to 0, so the quotient blows up, and a bottom factor to an odd power changes sign across the asymptote, so the two sides blow up opposite ways (a squared bottom factor would not: one line, no example since the app does not generate it).

**Read.** Two answers, left then right, in that order. At a glance, a jump: plug 1 into each rule; if the two numbers differ the "both equal" choices are gone. An asymptote: the bottom factor is to the first power, so the two "same direction" choices are gone.

**Example A (jump).** f(x) = −2x + 2 for x < 1; 2x − 7 for x ≥ 1. Figure: the left piece drawn up to x = 1 with a hollow end at (1, 0); the right piece from x = 1 with a filled dot at (1, −5). (1) The left dot glides along the left piece toward 1; readout 0.2, 0.02, settling on 0. The hollow dot: the piece never reaches 1 but gets as close as you like to 0. (2) The right dot glides along the right piece; readout settles on −5, the filled dot. (3) x → 1⁻: f → 0; x → 1⁺: f → −5.
**Example B (asymptote).** f(x) = (x − 2)/((x + 1)(x + 2)) at x = −1; the dashed blue line x = −1. (1) Just left, x = −1.01: top −3.01, negative; (x + 1) = −0.01, negative and tiny; (x + 2) = 0.99, positive. Negative over negative times positive: positive. Divided by something tiny: huge. The probe's denominator tag shrinks to 0, the result tag climbs off the card: +∞. (2) Just right, x = −0.99: (x + 1) = +0.01; the sign flips; the rest does not: −∞. (3) x → −1⁻: f → ∞; x → −1⁺: f → −∞.
**Quick case C (hole), only if generated:** cancel, glide both dots toward the reduced value, hollow dot there; both sides give the same number.

**Fast.** Jump: evaluate each rule at the break; left rule for the left arrow. Asymptote: the sign of each factor just left, then just right; an odd bottom factor flips, so once one side is known the other is opposite.

**Sense.** At a jump the two answers are the two pieces' heights at the break. At an asymptote the sign of the whole quotient just left of −1 can be eyeballed from the graph's side.

**Check.** Jump: plug 1 into the left rule (−2 + 2 = 0) and the right rule (2 − 7 = −5). Asymptote: f(−1.01) ≈ +304, f(−0.99) ≈ −296, computed once on the board.

**Rule out.** Jump: "both −5" and "both 0" dim together (the rules give different numbers at 1); then left-right order. Asymptote: "both ∞" and "both −∞" dim together (first-power bottom factor); then one sign test.

**Line.** "The little sign says which side. Left rule for the left arrow."

**Trap.** Using the x ≥ 1 rule for the left approach because "1 belongs to that piece" (the decoy "−5 then −5"); and at an asymptote assuming "−∞ on the left, +∞ on the right" from the memory of 1/x (the decoy). The gliding left dot stopping at the hollow 0, and the factor-by-factor sign at −1.01.

**Kit.** `plot` with `from`/`to` and `"ends": ["open","closed"]`, `glide` with `@y` readouts (exist), `asymptote` line, `probe` in quotient mode. **Writer.** Strongest: three kinds, new notation to define in plain words, and the two gliding readouts are the lesson.

---

### `rational-function-features` — Asymptotes, hole, domain, far-away height. Mixed: six questions, three generated. F8.

**Standard.** HSF.IF.C.7d: "identifying zeros and asymptotes when suitable factorizations are available, and showing end behavior." The app asks features and never draws the graph; the lesson draws it. Generated kinds: vertical asymptotes (3), horizontal asymptote (2), domain (1); x- and y-intercepts are described but not generated, one line each if `facts.ts` has them.

**Foundations first.** (1) A rational function is a top polynomial over a bottom one. (2) The zero line for it: a bottom zero is a place where we divide by zero. The probe in quotient mode: as x nears a bottom zero the bottom tag shrinks to 0 while the top does not, the result grows off the card, and the dot leaves: a *vertical asymptote*, a dashed blue line the graph runs along and never reaches. (3) If the same factor is on top and bottom, it cancels; both tags shrink together and the result settles on a number, but the function still has no value there: a *hole*, one missing point, drawn hollow. **Bottom zero: asymptote, unless it cancels: then a hole.** (4) The *domain* is every x allowed; every bottom zero is out, cancelled or not. (5) Far away the two leading terms fight; the pull-back lands the teal graph on a violet dashed horizontal line, the *horizontal asymptote*: top degree smaller, y = 0; equal, leading over leading (numbers out front included); top bigger, none, since x³/x² = x keeps growing.

**Read.** The asked feature goes gold. "Vertical asymptotes": x = the bottom zeros that survive cancelling. "Domain": all reals except every bottom zero. "Horizontal asymptote": y = a number, or none. At a glance: cancel first, then compare the two degrees.

**Example A (vertical asymptotes, with a cancel).** f(x) = 3(x + 1)(x + 3)(x + 4)/((x + 1)(x − 1)). (1) Bottom zeros: −1 and 1, marked on the line. (2) (x + 1) is on top too: it cancels; the probe near −1 shows both tags shrinking, the result settling on −9 (3 · 2 · 3/(−2)), the dot hollow: a hole. (3) (x − 1) stays: the probe near 1 shows the bottom tag at 0, the result off the card: asymptote x = 1. (4) x = 1. The top zeros −3 and −4 are where the graph meets the axis, not asymptotes.
**Example B (horizontal, equal degrees).** f(x) = 3(x − 2)(x − 3)/(2(x − 1)(x + 1)). Degrees 2 and 2; leading terms 3x² and 2x²; pull back: the graph flattens onto violet y = 3/2. **Quick case:** 3(x − 3)(x + 3)(x − 1)/((x + 2)(x + 1)): degrees 3 and 2, top bigger: none; pulled back, the graph keeps climbing like x.
**Quick case C (domain).** 3(x + 1)(x − 4)/(−(x + 1)(x + 2)(x + 4)): bottom zeros −4, −2, −1; −1 cancels to a hole, still out. All reals except −4, −2, −1.

**Fast.** Cancel; leftover bottom factors are asymptotes; cancelled ones are holes; all bottom zeros leave the domain; degrees compare for the horizontal, ratio of the numbers out front when equal.

**Sense.** Plug x = 1000 in the head: 3·1000²/2·1000² is about 3/2. Near an asymptote plug x = 1.01 and see a number in the hundreds.

**Check.** The cancelled x gives a plain number in the reduced form (a hole, not an asymptote); the surviving one gives division by zero.

**Rule out.** Top zeros offered as asymptotes: gone. The hole's x listed as an asymptote: gone. Horizontal y = 0 or "none" when the degrees are equal: gone together. 2/3 upside down: gone, "top over bottom".

**Line.** "Bottom zero: asymptote, unless it cancels: then a hole. Same degree: leading over leading."

**Trap.** Listing the hole as an asymptote (the decoy "x = −1 and x = 1") and keeping it in the domain (the decoy "except −4 and −2"); writing the ratio upside down. The hollow dot that is still a gap in the line, and the violet line labeled 3x²/2x².

**Kit.** `probe` quotient mode, `plot` with `holes`, `asymptote` lines in blue and violet, `view` pull-back, `signline` with `asymptote`/`hole`, `dim`. **Writer.** Strongest: six readings off one picture, the blow-up and the hole staged on the probe.

---

## Precalculus: fundamental-theorem-algebra

### `polynomial-root-count` — How many roots, and which root is forced. Mixed: count; the mirror partner; possible real counts. F5, F9.

**Standard.** HSN.CN.C.9: "Know the Fundamental Theorem of Algebra." The conjugate kind is linked to HSN.CN.A.3 (moduli and quotients), a stretch; it is the consequence of real coefficients and belongs with C.9.

**Foundations first.** (1) The theorem in one sentence: a polynomial of degree n has exactly n roots in the complex numbers, counting each as many times as its multiplicity. (2) Why it feels wrong and isn't: the parabola y = x² + 1 misses the axis, yet x² + 1 = (x + i)(x − i) has two roots; the real graph shows only the roots on the real axis, the rest are off it on the complex plane. (3) The degree: from a sum, the highest power wherever written; from factors, each factor's degree times its exponent: (x + 3)³ counts 3, (x² + 5) counts 2. (4) The mirror: when the coefficients are real, a nonreal root a + bi brings its *conjugate* a − bi, same real part, flipped i part, its reflection across the real axis. So nonreal roots come in pairs, and the number of them is even.

**Read.** "How many roots, counting multiplicity": the degree, nothing else. "Which other number must be a root": the conjugate. "Which number of real roots can it have": the degree minus an even number. At a glance: the degree is read before anything is counted.

**Example A (count).** p(x) = (x + 3)³(x − 5)²(x² + 5). (1) 3 + 2 + 2 = 7 roots. Picture: the complex plane with the real axis as the graph's x-axis: −3 marked "×3", 5 marked "×2", and the pair ±√5 i off the axis, mirrored; seven dots. (2) The real graph beside it meets the axis only at −3 and 5; the other two are the ones it cannot show. (3) 7.
**Quick case:** x⁸ − 3x⁵ + 4: degree 8, eight roots, however few the graph shows. Decoys 3 (three terms), 9, 7.
**Example B (conjugate).** Degree 5, real coefficients, root −2 + 3i. The dot at (−2, 3) flips across the real axis onto (−2, −3): −2 − 3i. Same real part; only the i part changes sign.
**Quick case C.** Degree 4: real roots 4, 2 or 0, since the nonreal ones pair up; never 3 or 1; 6 is more than the degree. Answer 4.

**Fast.** Count: the degree. Partner: keep the real part, flip the sign on i. Real count: degree minus 0, 2, 4, ...

**Sense.** Multiplicities add to the degree; the mirror partner has the same distance from the real axis.

**Check.** Count the dots on the plane against the degree; for the conjugate, the pair's sum (2a) and product (a² + b²) are both real, so a real quadratic holds them.

**Rule out.** A count equal to the number of factors or terms: gone. A "conjugate" that swaps the parts (3 − 2i) or flips the real part (2 + 3i): gone together, "the real part never moves". An odd number of real roots for an even degree: gone.

**Line.** "Degree n, n roots, counting repeats. The ones you can't see come in mirror pairs."

**Trap.** Counting factors instead of exponents (3 for (x + 3)³(x − 5)²(x² + 5)) and counting (x² + 5) once; swapping the parts of the conjugate. The seven dots and the flip across the axis.

**Kit.** None new: complex plane as in `complex-plane-forms`, `dot`, `flip`, `dim`. **Writer.** Capable cheaper model: three short cases, each fully specified.

---

## Precalculus: complex-factorization

### `complex-quadratic-factors` — Factor, solve, or build a quadratic with nonreal roots. Mixed: three kinds. F9, with family 15's completing the square.

**Standard.** HSN.CN.C.8: "rewrite x² + 4 as (x + 2i)(x − 2i)." HSN.CN.C.7: "Solve quadratic equations with real coefficients that have complex solutions." HSA.REI.B.4a and b: completing the square to (x − p)² = q; "write them as a ± bi."

**Foundations first.** (1) i² = −1, named from family 5, so (√2 i)² = −2 and √(−2) = √2 i. (2) The parabola that misses the axis: y = x² + 10x + 27 has its vertex at (−5, 2), above the axis; no real zero. The degree says two roots exist (F9); they are off the real axis. (3) The mirror: the two roots on the complex plane sit at −5 ± √2 i, reflections across the real axis, on the dashed vertical through −5, which is the parabola's own axis of symmetry drawn on the real graph beside it. **The real part of the roots is the parabola's axis.** (4) Difference of squares still works: x² − a² = (x + a)(x − a), so x² + 18 = x² − (√18 i)² factors the same way.

**Read.** "Solve over the complex numbers": two answers, a ± bi, a from the axis. "Factor over the complex numbers": two linear factors with i in them. "Choose its equation" from roots p ± qi: x² − (sum)x + product. At a glance, solving: the axis is −b/2 (−5 for b = 10), so the real part of the answer is known before any work, and every choice with a different real part is gone.

**Example A (solve).** x² + 10x + 27 = 0; choices −10 ± √2 i, −5 ± √2, −5 ± √2 i, 5 ± √2 i. (1) Axis: x = −5; height there 25 − 50 + 27 = 2, above the axis: no real roots; the parabola drawn. (2) Complete the square: x² + 10x + 25 = −2; (x + 5)² = −2. (3) x + 5 = ±√(−2) = ±√2 i. (4) x = −5 ± √2 i; the two dots appear on the plane, mirrored on the line Re = −5. (5) Check: sum −10 = −b; product (−5)² + 2 = 27 = c.
**Quick second case** (a different look: odd b, so the answer is a fraction): x² − x + 6 = 0: (x − ½)² = −23/4; x = ½ ± (√23/2) i = (1 ± √23 i)/2. The decoy 1 ± √23 i forgot the 2 under both.
**Example B (factor).** x² + 18 = x² − (3√2 i)² = (x + 3√2 i)(x − 3√2 i), √18 simplified to 3√2 first. Check by multiplying back: x² − 18 i² = x² + 18.
**Example C (build).** Roots −1 ± 3i: the axis is −1, the rise is 3² = 9: (x + 1)² + 9 = 0, so x² + 2x + 10 = 0; or sum −2, product 1 + 9 = 10. Three beats.

**Fast.** Solve: complete the square (the axis first, then the leftover under a root with i). Factor x² + k: (x + √k i)(x − √k i), radical simplified. Build: x² − (sum)x + product, with sum 2p and product p² + q².

**Sense.** The real part is the axis, visible on the parabola; a sum of squares never factors without i.

**Check.** Multiply back, or sum and product against −b and c.

**Rule out.** Solve: a wrong real part (−10, or 5) and a missing i: gone together, "the axis is −5 and the parabola misses the axis". Factor: multiply back each: x² − 18, x² + 324, x² + 6√2 i x − 18: all gone in two lines each. Build: a sign error in the middle term (x² − 2x + 10), a product done as 1 − 9 (x² + 2x − 8), a product missing the 1² (x² + 2x + 9): gone with sum and product read aloud.

**Line.** "The real part is the axis; the i part is how far above the axis the parabola sits, under a root."

**Trap.** Dropping the i (−5 ± √2), √−18 = 18i, (x + 3√2 i)² for a sum of squares, and using b instead of b/2 (−10 ± √2 i). The parabola missing the axis (so the roots cannot be real), and multiplying back on the board.

**Kit.** None new: two `axes` panels on one card as in `complex-plane-forms`, `dot`, `flip` for the mirror, a dashed `seg` for the axis, `dim`. **Writer.** Strongest: three kinds, and the insight (the axis of symmetry is the real part) must be staged on both panels at once.
