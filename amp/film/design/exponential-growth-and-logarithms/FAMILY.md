# Exponential growth and logarithms, Algebra 1 to Algebra 2: family design

Seven skills, 43 problem types. Planning snapshot: `src/curriculum/catalog.ts`, the engine templates, `film/facts.ts` for every variant, snapshot 2026-11-09. This is the family level: the one idea, the foundations in the order they are built, the picture system, the habits every lesson in the family builds, the kit it needs, who should write what, what is misfiled, and the pilot. Per-type concepts use these foundations and pictures.

---

## 1. The idea underneath the whole family

Place value was one trick applied over and over. So is this: **a quantity that changes by the same factor every equal step.** Linear change adds the same amount each step; exponential change multiplies by the same factor each step. Everything from the first geometric sequence to the infinite sum is this trick and its consequences:

- the exponent is the number of steps taken from the start;
- a percent is a factor in disguise;
- a step can be any length of time, so the exponent may be t/5, and a long step can be cut into short ones;
- multiplying eventually beats adding;
- a logarithm asks how many steps;
- the exponent laws, read backward, are the log rules;
- the sum of the terms has a closed form because multiplying the sum by the factor shifts it one step.

The learner has already met an exponential: the place-value chart, where every column is ten times the one to its right (place-value foundation 7). The digit that slid left under "times ten" was stepping along 10^n. The first Algebra 1 film says this in one line, and the base-10 logarithm lesson says it again: log 1000 = 3 is "three shifts".

### What this family takes from others

Named in one line when used, never re-taught, and shown with the owned picture.

- **Family 4, exponents** (the biggest debt): an exponent counts factors; b^0 = 1; b^(−n) = 1/b^n; b^(1/n) is a root; b^m · b^n = b^(m+n); (b^m)^n = b^(mn). Rational exponents are an Algebra 2 skill in this catalog but Algebra 1's time-scale types ((1/4)^(t/2), 0.94^(1/12)) need them; the sequence has to honor that.
- **Family 10, percent**: an increase of p% is ×(1 + p/100), a decrease ×(1 − p/100); the percent bar cut into kept and lost.
- **Family 13, functions**: rule, table and graph are one thing; f(x) notation; domain and range; a sequence as a function on the whole numbers; inverse functions (the logarithm is the inverse this curriculum uses most).
- **Family 14, linear**: a constant rate adds the same amount per step; the line.
- **Family 11, equations**: the same to both sides; undo in reverse order.
- **Family 7, multiplication**: "times as many"; repeated multiplication.
- **Family 2, place value**: the ×10 shift; the comma groups are 10^3.
- **Family 21, money**: interest; cents rounded each year.

### The foundations, in the order they are built

1. **Same factor each step.** (A1) Define: a geometric sequence, or an exponential quantity, is one where each value is the value before it times one fixed number. In a sequence that number is the *common ratio*; in a model it is the *growth factor* (or *decay factor*); the lessons say both words once and then say "factor". The test: divide each value by the one before; the quotients are all equal. The contrast is linear: the differences are all equal. The scratch-paper sketch (section 2) is born here and never leaves.

2. **The exponent counts the steps.** (A1) Start, then multiply by the factor once per step: value = start × factor^steps. In a sequence the start is term 1, and term n is n − 1 steps away: a_n = a_1 · r^(n−1). In a model the start is time 0, and time t is t steps away: a · b^t. A round numbered from 1 is like a sequence: 128 · (1/2)^(x−1). The step-by-step rule ("the next is the factor times this one": a_(n+1) = r · a_n) and the direct rule ("jump straight there") say the same thing in two ways. **Count the arrows, never the cells.** This kills the off-by-one that decides most rule-choice problems.

3. **A percent is a factor.** (A1) Growing by 6% is ×1.06. Losing 10% is keeping 90%: ×0.90. "Worth 75% of the year before" is ×0.75. Read backward, a base of 1.06 means it grows 6% per step; 0.94 means it shrinks 6% per step. The factor is always the *kept share*: never the lost share, never a subtraction.

4. **A step can be any length, and a long step can be cut into short ones.** (A1) "Doubles every 5 years": the factor is 2, the step is 5 years, the number of steps is t/5, so 300 · 2^(t/5). Half-life: factor 1/2, steps t/T. The factor for the stated stretch belongs to that stretch, not to one year. Cutting a step into n equal pieces: one piece's factor is the nth root, and b^t = (b^(1/n))^(nt) with nothing changed over the whole step; this is how a yearly factor becomes a monthly one (0.94^(1/12) ≈ 0.9949, about half a percent a month). Compound interest cuts the year by the bank's rule instead: each of n pieces earns r/n, so (1 + r/n)^(nt), which over a year gives a little more than r. Cut without end at rate 1 and the yearly factor settles at e ≈ 2.71828; at rate r it settles at e^r: continuous compounding. e is defined that way, in one table, the first time it appears.

5. **Multiplying eventually beats adding.** (A1 to A2) A line adds the same amount every step. An exponential with factor above 1 adds (b − 1) times its *current* value, and that amount grows. So however steep the line and however small the factor above 1, the exponential passes it and never comes back. "Eventually" can be slow (2^x needs x = 8 to pass 29x + 15), so the question is answered by a table or graph, not a feeling. Equal differences or equal ratios is the test; "it gets big fast" is not.

6. **Multiplying positives never gives zero.** (A1) b^x is never zero and never negative, so a · b^x + k never equals k: the graph hugs the line y = k and never touches it, the horizontal asymptote. Range y > k when a > 0, y < k when a < 0. Domain: every real number for the bare function; t ≥ 0 when a model starts at a first count; whole numbers only for a sequence, which is graphed as separate points. The y-intercept is the start, because b^0 = 1.

7. **A logarithm counts the steps.** (A2) log_b N asks: starting from 1, how many factors of b make N? log_2 32 = 5 because five steps of ×2 reach 32. So log_b N = x and b^x = N say one thing, and **the base of the log is the base of the power.** "log" alone is base 10 (the shift count from place value); "ln" is base e. Steps backward (dividing) are negative: log_3 (1/81) = −4. A root is a fraction of a step. A number between two powers has a log between two whole numbers: 100 < 831 < 1000, so 2 < log 831 < 3.

8. **Multiply the numbers, add the steps.** (A2) b^m · b^n = b^(m+n) read from the log side: log_b (MN) = log_b M + log_b N. Dividing subtracts. A power multiplies the count: log_b (M^k) = k · log_b M. Change of base: one step of base B is log_b B steps of base b, so log_B x = log_b x / log_b B (log_4 x is half of log_2 x because one ×4 is two ×2s). Nothing here is new; each is an exponent law the learner owns, read backward.

9. **Same base, same count: match the exponents.** (A2) If b^m = b^n, with b positive and not 1, then m = n. To solve, write both sides as powers of one base (the smallest prime base that works) and set the exponents equal. When no common base exists, take a log of both sides: the exponent comes down, the exact answer is a logarithm, and a calculator gives the decimal when one is asked.

10. **There is no step count for zero or a negative.** (A2) No number of ×b steps from 1 reaches 0 or a negative, so log of 0 or of a negative does not exist. Domain of log_b x: x > 0; of log_b (x − 1): x > 1, with a vertical asymptote there. After solving a log equation, every inside is checked positive; a root that makes any inside zero or negative is rejected, in rust, with the reason.

11. **Shift one step and subtract: only the ends survive.** (A2) S = a + ar + ... + ar^(n−1). Then rS = ar + ar² + ... + ar^n is the same list moved one step along. Subtract and every middle term cancels: rS − S = ar^n − a, so S = a(r^n − 1)/(r − 1). When |r| < 1 the terms shrink toward zero and the sum settles at a/(1 − r); when |r| ≥ 1 they do not shrink and there is no finite sum. Sigma notation is a label for the list: the index runs from the bottom number to the top, so the number of terms is top − bottom + 1.

---

## 2. The visual language

One picture system, grown from the number-line arcs the child counted in grade 1, posed four ways. Choose the picture by asking: what should the learner sketch to conquer this problem fast? Here the sketch is almost always the same thing.

### The sketch: the step table with arrows

A two-row table. Top row: the step (n, x, t, "year", "bounce"). Bottom row: the amount. Between neighboring top cells, a small muted arc with the step size (+1, +5 yr). Between neighboring bottom cells, an arc in the amount's color with the factor (×2, ×0.75, ×(−1.5)). That is the whole family on scratch paper:

- the exponent is the number of arcs from the start to the asked cell (not the number of cells);
- the factor is found by dividing across one arc;
- linear or exponential is decided by writing both kinds of arc under the amounts, differences and ratios, and seeing which row is constant;
- a log is the same table with the amount given and the arc count asked.

Lineage: in grade 1 the number line wrote "+10" on an arc between ticks so the child counted jumps, never ticks. Here the arc says ×2 and the learner counts arrows, never cells. The first Algebra 1 film says so in one sentence.

### The staircase: bars to scale

Under each amount cell a bar stands on a shared baseline, its height to scale, its amount written on it. Each bar is the factor times the one before, and a muted ghost of the previous bar is drawn inside (or around) it, so ×2 is a bar the ghost fits into twice, and ×0.75 is a bar three quarters as tall with the lost quarter cut off the top in rust. A negative factor flips the bar across the baseline; a negative start hangs the bars below it. When the bars outgrow the frame the camera pulls back and the early bars flatten to slivers; that pull-back *is* the lesson about exponential growth, and when a blue linear bar set is in the same frame, the pull-back flattens it to almost nothing. The bars are the app's own figure in `geometric-series-sum` ("the bars show each day's coins"), so the lesson's picture is the problem's picture.

For sums the bars slide into one tower; the tower's height is the sum. For the shift-and-subtract, the tower of rS is drawn beside the tower of S with each slab level with the slab it equals, one place up; the matching slabs fade and the two ends remain. For a shrinking infinite series the tower rises toward a line, each new slab a fixed fraction of the remaining gap, and the line is the sum.

### The graph

The bar tops become points on axes (P7). A sequence stays as separate points, nothing between them, because its domain is whole numbers. A model in time gets the smooth curve through them. The asymptote is a dashed line, horizontal for an exponential, vertical for a log. For linear against exponential: a blue line and teal points or curve, with gap sticks at each whole x shrinking and then flipping; the first x where teal is on top goes gold. A log graph is the exponential graph with the coordinates swapped: each point reflects across the dashed line y = x, and the horizontal asymptote stands up vertical. Base between 0 and 1: the falling exponential reflects to a falling log that still passes (1, 0) and stays right of the y-axis.

### The timeline with factor arcs

A horizontal time line (P3) with ticks at each step length (every 5 years), a ×2 arc over each stretch, and t marked. The arcs between 0 and t are the steps, so t/5 is read off the picture. *Refine*: one ×0.94 arc over a year splits into twelve arcs, each ×0.94^(1/12), with the ends unmoved; one 5% year splits into four quarters, each ×1.0125, and the end sits a hair above the simple-interest mark. For continuous compounding the splitting runs on until the arcs blur and the end label settles at e^r.

### The percent bar

Family 10's bar: a bar for 100% of the current value, cut at the percent; the kept part stays teal and the lost part slides off in rust; for growth the bar extends past 100% by the added part in gold. The kept part is the next bar in the staircase. One beat, once per lesson where a percent appears.

### The ladder: the step table stood on end

For logs the same two-row table turns vertical: rungs with the step count on the left (0, 1, 2, 3, ...) and the amount on the right (1, b, b², b³, ...). Reading right to left along a gold arrow is the log. A number between two amounts sits at its true step height (831 sits near the 1000 rung, since log 831 ≈ 2.92) and the lesson claims only what the problem asks: between 2 and 3. Two ladders on one amount column for change of base: the base-4 rungs land on every second base-2 rung, so every base-4 count is half the base-2 count. Interest tables that the problem gives vertically (year | A | B) use the same vertical layout with blue +120 arcs beside one column and teal ×1.03 arcs beside the other.

### Color means one thing each

- **teal**: the exponential quantity: its bars, points, curve, ×b arcs and amount row.
- **blue**: a linear quantity set against it: the line, its +d arcs, a simple-interest account.
- **rust**: the part lost in decay (cut off the bar), a rejected root, the second of two compared quantities when neither is linear.
- **gold**: the one thing in question right now: the asked step count, the word in the problem that gives a fact ("every 3 years", "75% of", "term 7", "at the start"), the first column where two lists disagree, the first x where the exponential wins. One gold thing at a time.
- **muted**: ghosts, the +1 step arcs, placeholders, choices ruled out.

### The motions (each proves a foundation)

- **Step**: a copy of the last bar slides one column right and stretches, shrinks or flips to the factor; the ×b arc draws; the cell fills. The same stretch every time. F1, F2.
- **Divide across**: the quotient of two neighbors is written on their arc. F1.
- **Cut**: the percent bar cut at the percent; the lost part leaves in rust. F3.
- **Refine**: a long arc splits into n sub-arcs with the root factor; the ends do not move. F4.
- **Pull back**: the view zooms out as the bars outgrow it; the blue line flattens, the teal bars do not. F5.
- **Gap sticks**: vertical segments between line and curve at each whole x, shrinking and then flipping. F5.
- **Never zero**: the camera pushes in toward the asymptote and the gap halves and halves (a callback to the place-value zoom into the flat: you can always cut again). F6.
- **Read back**: on the ladder, a gold arrow from the amount to its step. F7.
- **Swap**: the dots reflect over y = x; the asymptote stands up. F7, F10.
- **Match**: on the board, both sides rewritten over one base; the exponents go gold; a line sets them equal. F9.
- **Shift and subtract**: rS written under S, term under the term it equals, one column over; the cancelling pairs fade; the ends stay. The towers do the same beside the board. F11.
- **Fill the gap**: the tower of a shrinking series rising toward its line. F11.
- **Dim**: choices that cannot be right fade together, in one beat, with one reason.

### What is deliberately not drawn

No bars that are not to scale (when 2^20 is on screen the frame pulls back; the bar is never faked). No pie charts. No "move the decimal" style tricks for logs. No log curve drawn free-hand: the plot is the real function, and the asymptote is where the function really goes.

---

## 3. How lessons in this family should go

### The three things to find, always

Every problem here is read by finding three facts, then the question. **Start**: the amount at the first count (term 1, time 0, round 1); is the count numbered from 0 or from 1? **Factor**: given outright (×2, ratio 1/2), hidden in a percent (loses 10%: ×0.9), or found by dividing two neighbors (or taking a root when the neighbors are k steps apart). **Step**: one unit, or a stretch ("every 5 years", "half-life 8 hours", "per round"). The word that gives each goes gold as it is read. Then the question: a later value, the rule, the percent or step hidden in a rule, the step count (a log), the sum, or a feature of the graph. A learner who has these three has the problem; the rest is counting arrows.

### At a glance, before any work

- **Direction.** Factor above 1 grows; between 0 and 1 shrinks; negative alternates. The answer must be on the right side of the start. This alone throws out half the choices in most multiple-choice types here.
- **Rough size.** Doubling three times is ×8; halving three times is ÷8; 7% a year for four years is a bit over 28%, because each year's gain is on a bigger amount. At the same rate, compound beats simple from year 2 on.
- **Start check.** At the first count the rule must give the start: n = 1 in a_n, t = 0 in a model, x = 1 in a round. Every off-by-one decoy fails this in one second.
- **One-step check.** One step from the start must give the second value. Every wrong factor fails this.
- **Signs.** With a negative ratio, count the negative factors; an even count is positive.
- **Logs.** Between which two powers of the base does N sit? That bounds the answer before it is found.
- **Sums.** The sum is more than the largest term and, for r ≥ 2, less than twice it; for a shrinking series the sum is less than a/(1 − r) and the first term is more than half of it when r ≤ 1/2.

### The sure fast ways (taught as the method, each with the picture that explains why it never fails)

- **Later value**: start × factor^(arrows). Term n of a sequence: n − 1 arrows. Time t with step T: t/T arrows.
- **The factor from a percent**: write the kept share as a decimal. "Loses 12%": 0.88. "Grows 6%": 1.06. Always.
- **The factor from two neighbors**: divide the later by the earlier. From two values k steps apart: the kth root of their quotient.
- **The percent from a base**: 1.06 is +6%, 0.94 is −6%, and the percent belongs to the stretch in the exponent: 1.06^(t/3) is 6% every 3 years, not 6% a year and not 18%.
- **Rewrite the time scale**: b^(t/T) = (b^(1/T))^t, and b^t = (b^(1/n))^(nt). Same total, finer steps. The bank's compound formula is the one exception to the root, and the lesson says why.
- **Linear or exponential**: write the differences; write the ratios; the constant row names it. Neither constant: neither.
- **Who wins**: fill the table until the exponential is on top; the first whole x where it is on top is the answer, and after it the exponential stays on top.
- **A log**: write N as a power of the base; the exponent is the answer. A reciprocal gives a negative, a root a fraction. No clean power: change of base, log N / log b, on the calculator. Between two whole numbers: the two neighboring powers.
- **Same base**: both sides as powers of the smallest prime base; match the exponents; solve.
- **No common base**: isolate the power, take the log of both sides, the exponent comes down; x = log_b (N) exactly; divide by the coefficient of t if there is one.
- **Log equation**: one log on each side (or one log equal to a number) using the rules; rewrite as a power; solve; check every inside is positive.
- **Sum**: S_n = a(r^n − 1)/(r − 1). Count the terms first (top − bottom + 1 in sigma notation; "the last term 192 = 3 · 2^6" means seven terms). Infinite: a/(1 − r) only when |r| < 1.
- **Time to a target**: divide both sides by the start; take a log (base 10 or ln, either works); divide by what multiplies t; round as asked.

Shortcuts that sometimes fail are never taught: "the exponent is n"; "multiply by the percent"; "a percent every year is that many percent times the years"; "log(a + b) = log a + log b"; "cancel the logs"; "a/(1 − r) for every series".

### Sense, then check

Sense before the answer is boxed: direction and rough size, as above; a change is less than the payment; a share is less than the total; a model's value at t = 0 is its start. Check after:

- a later value: multiply from the start one step at a time when n is small (32, −48, 72, −108, 162), or divide back;
- a rule: plug in the first count (must give the start) and one more row; for a table, *every* row, because decoys are built to pass one (12 · 3^x and 4 · 3^x agree nowhere, but 8x + 4 agrees with 4 · 3^x at x = 0 and x = 1);
- a log: raise the base to the answer;
- an equation: substitute; for a log equation, substitute into every inside;
- a time: put it back into the model and see the target;
- a sum: add the terms directly when there are few; otherwise check the term count and the size;
- a percent read from a base: write the factor back from the percent and compare.

### Ruling out nonsense choices

Multiple-choice decoys in this family are the misconceptions, so the lesson names each as it dims:

- a linear choice (30000 − 3000x) when the story says "percent of" or "times": equal ratios, not equal differences;
- a base equal to the percent itself (0.1^x), or the wrong direction (1.1^x for a loss), or a subtraction in a recursive rule (a_(n−1) − 0.25);
- a rule that fails the start check (n − 2, or n, in the exponent; 12 · 3^x when the table starts at 4; 128(1/2)^x when round 1 has 128);
- a doubling time in the wrong place: 2^(5t) doubles five times a year, 2^t once a year; only 2^(t/5) doubles once in five years (test t = 5);
- an interest total far too big (14,367 from 8,000 in three years at 5% is near doubling) or too small (8,304 is less than one year's interest), or exactly simple interest (9,200) when the question says compounded;
- a log form that swaps base and answer: in log_3 81 = 4 the base 3 stays the base;
- a domain in the wrong variable, or a range that ignores the start (P > 0 when the first count is 50 and it grows);
- a "sum" for a series whose ratio is 1 or more in size;
- in the bounce problem, a total that counts only the falls or only the first bounce.

Choices dim together, in one beat, with the one reason; then the surviving choice is proved.

### Misconceptions that are real, and the picture that makes each impossible

Found by asking what Algebra 1 and 2 students actually write, not to fill a slot.

1. **Off by one in the exponent** (a_n = a_1 · r^n; f(x) = 128(1/2)^x for round x). The arrows: term 5 is four arrows from term 1, visible and countable.
2. **The percent is the multiplier** (loses 10%: ×0.1), or **subtract the percent as a number** (a_(n−1) − 0.12). The cut bar: the kept part is what remains and what gets multiplied next.
3. **Adding the percent each year** (simple interest for a compound account; "6% every 3 years is 2% a year"). The staircase: each year's slab is bigger than the last; the gold percent rides the stretch it belongs to on the timeline.
4. **Doubling time put on top of the exponent** (2^(5t)). The timeline: five years hold one ×2 arc, so t years hold t/5 of them.
5. **Losing the sign with a negative ratio**, and (−4)^3 read as −4^3. The flipped bars: every step crosses the baseline, so the sign alternates and the count of flips decides.
6. **"It grows fast, so it is exponential"** (320, 280, 200, 80 looks dramatic but its differences grow and its ratios do not match). The two arc rows: only one row can be constant.
7. **log(M + N) = log M + log N**, and **cancelling logs** across a subtraction (log_5 x − log_5 (x − 24) = 1 read as x − (x − 24) = 1). The ladder: multiplying amounts adds rungs; adding amounts does nothing clean on the ladder, and the lesson shows log 2 + log 3 = log 6, not log 5.
8. **Keeping the negative root of a log equation** (x = −27 alongside x = 8). The read-back arrow has nowhere to go for a negative amount; the rejected root goes rust with "log_6 (−27) does not exist".
9. **The range reaches zero** (y ≥ 0; or −3 · 4^x + 1 given range y > 1). The never-zero zoom: the gap halves forever; and a negative a flips the whole staircase below k.
10. **Reading the factor's percent as "per year" when the exponent is t/3**. Same picture as 3: the arc spans three years.
11. **A sequence drawn as a curve**. The separate points, with the question "what would a(4.5) be, the term between the fourth and the fifth?" answered by the empty space.
12. **Change of base upside down** (log_8 32 = log 8 / log 32). Two ladders: the rung count in the coarser base is the finer count divided by rungs per coarse rung (5/3), never the reverse, and the answer must exceed 1 because 32 > 8.
13. **Compounding with the full yearly rate every period** (1.05^12 for monthly), or taking (1 − 0.06/12)^(12t) as equivalent to 0.94^t (it gives 0.9416^t, a 5.84% loss). The refine motion: the end of the year is fixed; twelve equal factors must multiply back to 0.94, which is the twelfth root, not 1 − 0.06/12.
14. **The last term for the sum**, or the wrong term count (a sum "to 192" or "k from 1 to 5" miscounted). The tower beside the staircase: the sum is the tower, the term is one slab, and the slabs are counted on screen.
15. **a/(1 − r) applied when |r| ≥ 1.** The tower that does not settle: each slab at least as big as the last.

### Lines worth remembering

Said once, at the moment they apply, and put on the board or in the recap.

- "Same factor each step."
- "Count the arrows, not the cells."
- "A percent is a factor: keep what is left." / "Lose 10 percent: keep 90: times 0.9."
- "The percent belongs to the stretch in the exponent."
- "Every five years: divide the time by five."
- "Finer steps, same total: the factor for one piece is the root."
- "Adding gets tired; multiplying never does."
- "Multiplying positives never gives zero."
- "b to the zero is one, so the start is the y-intercept."
- "A log asks: how many steps?"
- "The base of the log is the base of the power."
- "Multiply the numbers, add the steps."
- "Same base: match the exponents."
- "Check every inside is positive."
- "Shift one step and subtract: only the ends survive."
- "Shrinking terms add up to a number; terms that don't shrink don't."

### Pacing at this grade

Pacing: Build each new idea explicitly for Algebra 1 and 2 learners. One idea per beat, plain words before the picture, a pause after each key idea, motions finished before the voice moves on. For higher grades: a short "why" shot before each sub-skill's example rather than one long opening; a second example that adds one idea is brief once the method was shown fully; count words before rendering (about 0.42 s a word). The step table is drawn live in the first film of each skill, from the problem's own numbers, before the first example is worked.

---

## 4. Tools to build

What the kit has that this family uses as is: the board (`problem` with wrapped sentence choices, `write` with margin notes, `answer`, `watch`, `term`, `recap`, `\cancel`), `table` (cells, rows, columns, `show`, `highlight`, `given`), `bar` (one whole with a percent scale, `partition`, `shade`), `axes`, `plot` with points `on` a plot, `glide`, `view`, `seg` with `dash` and `extend` (the asymptote), `flip` over a line (the swap), `label`, `dot`, `highlight`, `dim` (specified). The `numberline` component specified by the place-value design (ends, ticks, arcs with step labels, `drop`, `zoom`) is the timeline's base.

### 4.1 `steps`: the step table with arrows, the staircase, the tower and the ladder

```json
{ "id": "s", "steps": true, "at": "TL",
  "head": "n", "amount": "a_n",
  "cols": [ { "step": "1", "value": 32 }, { "step": "2", "value": -48 }, { "step": "3", "value": 72 },
            { "step": "4", "value": -108 }, { "step": "5", "value": 162 } ],
  "factor": "\\times(-1.5)", "stepArc": "+1",
  "bars": true, "ghosts": true, "fit": "auto", "cell": [3, 1.4], "ink": "accent" }
```

- Built on `table`: a two-row table (`head` over the step row, `amount` over the amount row) with `cols` left to right; a `layout: "vertical"` turns it into the ladder (step column left, amount column right), which also serves the problem's own vertical tables (year | A | B, with `cols` becoming rows and two amount columns each with its own `ink` and arcs).
- Arcs: `s.arc.k` sits between col k and k + 1 in the amount row and carries `factor` (TeX; `"factors": [...]` for per-arc labels, so a differences row and a ratios row can both be drawn: `"diffs": true` adds a second arc row below with the differences). `s.steparc.k` carries `stepArc` in muted above the step row. Any arc can be shown, highlighted or relabeled (`{"do":"divide","target":"s.arc.2","tex":"\\frac{72}{-48}=-1.5"}` writes the quotient on it).
- Bars: `s.bar.k` stands under col k on a shared baseline, height to scale in one unit for the whole chart, the amount written on it; negatives hang below the baseline. `ghosts: true` draws `s.ghost.k`, the previous bar's outline inside bar k. `fit: "auto"` picks the unit so the tallest *shown* bar fits; `{"do":"fit","target":"s"}` on a word recomputes it with the pull-back animation when later bars are shown.
- Actions: `{"do":"step","target":"s.col.3","at":"times"}` fills cell 3, draws arc 2 and grows bar 3 from a sliding copy of bar 2 (stretch, shrink or flip to the factor); `{"do":"cut","target":"s.bar.2","keep":0.75}` cuts the top of a bar off in rust and slides it away (the percent cut); `{"do":"tower","target":"s","at":"P"}` slides all shown bars into one stacked column at a point, labeled with the sum; `{"do":"shift","target":"s","by":1}` draws the r·S tower beside the S tower with each slab level with the slab it equals, then `{"do":"cancel","target":"s.towers"}` fades the matched slabs; `{"do":"read","target":"s.col.5","from":"amount"}` draws the gold arrow from an amount to its step (the log); `{"do":"place","target":"s","value":831}` sets a dot at its true step height between rungs on the ladder; `{"do":"points","target":"s","axes":"ax"}` lights dots at the bar tops on an `axes` part sharing the baseline, for the hand-off to the graph.
- Names: `s.col.k`, `s.step.k`, `s.cell.k`, `s.arc.k`, `s.steparc.k`, `s.bar.k`, `s.ghost.k`, `s.tower`, `s.towers`, `s.rung.k`. `--dry` reports a bar label that cannot fit its bar and an arc label that collides with a neighbor.

### 4.2 The timeline: `numberline` gains factor arcs and `refine`

Extend the place-value `numberline`, not a new component: `arcs` take any TeX label (`\times 2`) and a span in units (`"span": 5`, so one arc covers 5 years); `{"do":"refine","target":"nl.arc.1","into":12,"tex":"\\times 0.94^{1/12}"}` splits an arc into n equal arcs with the new label (one label, repeated small, or shown once with "×12" when twelve would crowd); `"mark"` for t and for a target value with a label. The ends never move during a refine; that is the point.

### 4.3 The graph: small additions to P7

- `plot` grammar gains `exp(x)`, `e^x`, `ln(x)`, `log(x)` (base 10) and `log(x, b)`; `2^x` and `0.5^x` are confirmed to parse.
- Gap sticks are `seg` parts between two `on` points at the same x and need nothing new; a `"sticks": {"f": "f", "g": "g", "xs": [0,1,2,...], "ink": "by-top"}` convenience colors each by which function is on top, so an author does not hand-set eight inks.
- The swap: `flip` over the points of y = x already reflects dots; the log curve is plotted directly. Confirm `flip` accepts a list of dots and finishes before the plot draws.
- Separate points for a sequence: dots at `on` points, no plot; exists.

### 4.4 The board

- `series`: two or three aligned rows of terms, each term in its own column so `rS` sits one column over from `S`, with `{"do":"cancel","of":"sr","pairs":"middle"}` fading the matched terms and a `write` line for the difference. New, small; it is `stack` for symbols.
- `cases`: already on the roadmap (two columns for ± roots); here it holds the two roots of a log equation, one kept and one rejected with its reason in rust.
- `dim`: specified; used in every multiple-choice lesson here.
- The board math check must know `\log`, `\ln`, `e`, `\sum` and accept `\approx` lines with the stated rounding (log 4.5 ≈ 0.6532; a balance to the nearest cent), or every log lesson fails `--dry` on true lines.

### 4.5 Build order

1. `steps` with arcs, bars, ghosts, `cut`, `fit`: unlocks all six geometric-sequence types, ten of the sixteen exponential-model types, all four growth-comparison types and the sum types' staircase: about 30 types.
2. `numberline` factor arcs and `refine`: the six time-scale types (`rg-exponential-base-rate`, `exponential-time-scale`, `growth-model-rewrite`, `compound-growth`, `sat-fn-exponential-choice`, `exponential-points-statement`).
3. The ladder layout with `read` and `place`, and the `plot` grammar: the five logarithm types and the three property types, plus `function-graph-features` and `log-base-fraction-graph`.
4. `series`, `tower`, `shift`, `cases`, the math check: the four sum types and `log-equation`.
5. `dim` as it lands.

---

## 5. Which lessons need the strongest writer, and where the seam is

This division of work requires a strong concept, a kit that fits, a cheaper writer, a strong review, an independent sample review. The seam falls between lessons whose insight is a staged motion or a reading of a story, and lessons whose method is fully in the concept and whose picture is one component with named actions.

**Strongest writer.**

- The foundation films of each skill, where the picture is born and the words are defined: `exponential-model-rule` (start, factor, step; percent as factor; the linear decoy), `geometric-rule-forms` (two rules, one meaning; the arrows and the off-by-one), `logarithm-value` (the log defined as the step count; the ladder; negatives and fractions of a step).
- Motion that proves: `linear-or-exponential` and `exponential-overtakes` (the pull-back and the gap sticks are the standard's "observe" and "prove"); `geometric-series-sum` (shift and subtract as towers and as aligned rows); `infinite-geometric-sum` (the gap filling, and the bounce story whose rises double but whose first fall does not); `growth-model-rewrite`, `exponential-time-scale` and `compound-growth` (the refine, the bank's convention against the root, e defined from a table); `exponential-domain-range` and `function-graph-features` (never zero; the swap; model versus bare function).
- Reading and judgment: `exponential-model-value` (four input shapes under one name: table, percent, half-life, formula), `interest-compare-years` (which column is compound, then exact cents), `geometric-sequence-as-function` (sentence choices about separate points), `sigma-notation-represent` (arithmetic and geometric lists; counting terms), `log-equation` (the rejected root is reasoning, not arithmetic), `log-base-fraction-graph` (as long as its choices are prose).

**A capable cheaper model, from a concept with the kit complete**: `geometric-sequence`, `geometric-signed-term`, `geometric-sequence-rule`, `depreciation-recursion`, `exponential-initial-value`, `exponential-parameters-blanks`, `exponential-points-statement`, `sat-fn-exponential-choice`, `sat-entry-fn-exponential`, `graph-exponential-points`, `rg-exponential-base-rate` (after the pilot shows the timeline), `exponential-decay-table`, `exponential-passes-linear` (after `exponential-overtakes`), `logarithm-integer`, `log-exponential-form`, `log-rules-evaluate`, `log-expand`, `change-of-base`, `same-base-equation`, `common-base-exponential`, `exponential-log-solution`, `exponential-parameter-log`, `exponential-target-time`, `exponential-time-steps`, `geometric-series-total`.

Why these: one method per type, the one example and the trap named in the concept, the picture a single `steps` or ladder with `step`, `divide`, `read` and `cut` on the word, and `--dry` with the math check catching the arithmetic slips a cheaper writer makes. Review stays at least as strong as the writer, and an independent reviewer watches every lesson of the first wave.

---

## 6. Problem types to fix, and standards clauses the problems never practice

### Misfiled, mis-graded or badly conceived

- **`exponential-target-time` and `exponential-time-steps` (Algebra 1, `exponential-models`) need logarithms**, which this catalog teaches in Algebra 2 (`logarithms`, `exponential-equations`). Common Core places HSF.LE.A.4 in Algebra II. Either move both to `exponential-equations` or make the Algebra 1 path reach `logarithm-value` first. Also `exponential-time-steps` grades the intermediate steps with natural logs only (1.5041, 0.47); a learner using base 10 (0.6532, 0.2041) gets the same 3.20 and is marked wrong on the way; accept either. Its final answer "3.2" to the nearest hundredth should read 3.20.
- **`compound-growth`'s continuous variant** (A = Pe^(rt)) is Algebra 2 material; keep it only if the lesson defines e, as this design does, or move that variant.
- **`exponential-model-value`** expects "11535.00"; the checker must accept 11535 and 11,535.
- **`same-base-equation` and `common-base-exponential`** are one method (write both sides over one base, match exponents); the second is the two-base case. Merge, or make the second the quick second case of one lesson. Neither has a standard; the skill's HSF.LE.A.4 asks for a logarithm, which these never use. The honest link is HSA.REI.A.1 with HSN.RN.A.2.
- **`logarithm-integer` is a subcase of `logarithm-value`**; and **`exponential-passes-linear` is `exponential-overtakes`** with the functions given symbolically. Duplicates in the sense of the place-value design's list.
- **`sigma-notation-represent`** is half arithmetic series (4 + 0 − 4 ...), which belongs to family 13's `arithmetic-sequences`; it is filed under HSA.SSE.B.4 (the geometric sum formula), which it never practices. Keep the geometric half here; say both appear.
- **`log-base-fraction-graph`** says "choose the graph" but its choices are sentences describing graphs. HSF.IF.C.7 wants graphs; show four small graphs. Until then the lesson must teach the reading of the three features (through (1, 0), right of the y-axis, falling).
- **`logarithm-properties`** has no linked standards; HSF.BF.B.5 (+) and HSA.SSE.A.2 fit, and the (+) marks it as beyond the core, fine for Algebra 2 but worth saying.
- **`infinite-geometric-sum`** is not in the Common Core at all (the standard stops at finite sums). A reasonable Algebra 2 stretch; say so in the template.
- **`geometric-sequence-as-function`** calls a(4.5) "undefined". The intent is the domain (whole numbers); the wording should be "not a term of the sequence". (With a negative base, (−3)^3.5 is also undefined in the reals, which is a different fact and should not be the lesson.)
- **`interest-compare-years`**: the long sentence choices clip in the prompt text; confirm they render whole in the app and in the film's wrapped pills.
- **`growth-model-rewrite`**'s decoy (1 − 0.06/12)^(12t) is good and realistic; the lesson must say exactly why it is not equivalent (0.995^12 = 0.9416, not 0.94).

### Standards clauses no problem practices (the lessons fill some; the app should fill the rest)

- **HSF.LE.A.1a**: "Prove that linear functions grow by equal differences over equal intervals, and that exponential functions grow by equal factors over equal intervals." Never asked. The `linear-or-exponential` film shows it in one line on the step table (f(x + c)/f(x) = b^c, the same for every x); no problem asks for the proof.
- **HSF.LE.A.3**: "...exceeds a quantity increasing linearly, **quadratically, or (more generally) as a polynomial function**." Only linear is ever compared. A gap worth a type: 2^x against x² (passes at x = 5 for good, after losing from 2 to 4).
- **HSA.SSE.B.4**: "**Derive** the formula for the sum of a finite geometric series... For example, **calculate mortgage payments**." The derivation is never asked (the lesson does it); no payment or annuity problem exists. The growing-payments fund is a geometric sum but not a mortgage.
- **HSF.LE.A.4**: "...the base b is 2, 10, or e." The time types use 1.60 and 1.24, which need change of base, beyond the clause; no 2^(ct) or 10^(ct) with a coefficient c on t appears. The exact-logarithm part ("express as a logarithm the solution") is well practiced.
- **HSF.IF.C.7e**: "Graph exponential **and logarithmic** functions, showing intercepts and end behavior." Exponentials are graphed by placing points; a logarithm is never graphed by the learner, only chosen from prose.
- **HSF.BF.A.1b**: "build a function that models the temperature of a cooling body by adding a constant function to a decaying exponential." Never; a · b^x + k appears only in `exponential-domain-range`.
- **HSA.SSE.B.3c**: "to reveal the approximate equivalent monthly interest rate." `growth-model-rewrite` produces the rewritten form but never asks for the monthly percent (0.94^(1/12) ≈ 0.9949, about 0.51% a month). The lesson says the number; no problem asks it.
- **HSF.IF.B.4**: "intervals where the function is increasing, decreasing, positive, or negative" for these functions: not asked beyond end behavior and intercepts.

Linked standards that fit: `geometric-sequences` (HSF.BF.A.2, HSF.IF.A.3, HSF.LE.A.2), `exponential-models` (HSA.SSE.B.3, HSF.IF.C.8, HSF.LE.A.2, HSF.LE.B.5), `growth-comparison` (HSF.LE.A.1, A.3), `logarithms` (HSF.BF.B.5, HSF.IF.C.7), `exponential-equations` (HSF.BF.B.5, HSF.LE.A.4 for the log types only), `sequence-sums` (HSA.SSE.B.4 for the finite sums). The 7.RP.A.3 and 6.EE.A.2 links are foundations, not what these types teach.

---

## 7. The pilot

Five types, covering the arc in one sitting: both grade bands, every new tool, the three poses of the picture, open answer and multiple choice, and the foundations that every later lesson leans on.

| # | Problem type | Grade | Why first |
|---|---|---|---|
| 1 | `exponential-model-rule` | A1 | The picture is born here: start, factor, step read from a story and from a table; the step table drawn live with its two arc rows; the percent cut (loses 10%: ×0.9); the linear decoy dimmed for equal differences; every-row check on the table. Exercises `steps` arcs, bars, `cut`, `dim`. If this is not clear, nothing after it will be. |
| 2 | `geometric-rule-forms` | A1 | Two rules, one meaning; the off-by-one that decides most rule choices (a_1 = −4 from a_2 = −6, a_3 = −9; the n − 1 exponent proved by the start check); the backward recursion decoy; the bounce story. Exercises `divide`, the arrows counted aloud. |
| 3 | `rg-exponential-base-rate` | A1 | A percent is a factor, read backward from a base, and the percent belongs to the stretch in the exponent (6% every 3 years, not per year, not 18%). Exercises the timeline with factor arcs; the realistic "18%" decoy. Sets up `growth-model-rewrite` and `compound-growth` in the next wave. |
| 4 | `logarithm-value` | A2 | The logarithm defined as the step count on the ladder; log 1000 as three shifts (the place-value callback); a reciprocal as steps backward (log_3 (1/81) = −4); the two forms as one table read two ways. Exercises the vertical layout and `read`. The first A2 film in the family; everything in `logarithm-properties` and `exponential-equations` stands on it. |
| 5 | `exponential-overtakes` | A2 | The family's defining fact as a motion: the blue line ahead for seven steps, the gap sticks shrinking and flipping at x = 8, the pull-back that flattens the line. Exercises the graph hand-off (`points`), gap sticks, `fit`. Teaches the table-until-it-flips habit and "after it, the exponential stays on top". |

If the five land, the next wave is `log-equation` (the rejected root in `cases`), `geometric-series-sum` (shift and subtract as towers and as `series`), `growth-model-rewrite` and `compound-growth` (the refine, the bank's convention, e), and `infinite-geometric-sum` (the gap filling and the bounce), which complete the tool set. No batch production inside the family until independent review of the pilot is complete.
