# Exponential growth and logarithms, part 1: ten concepts

Geometric sequences (six types) and the first four exponential-model types. Each stands on the family design's foundations 1 to 4 and draws the step table with arrows, the staircase to scale, the percent bar and the timeline. Two conventions, said once in each skill's first film and never again: a sequence is numbered from 1 and a model from time 0; and `a_{n+1} = r a_n` and `a_n = r a_{n-1}` are the same sentence ("the next term is r times this one") written with different letters, and the app uses both.

Every film in the geometric-sequence skill opens with the same short build (about twenty seconds): a two-row table, positions on top, amounts below; divide across each arc between neighbors; the quotients are all the same number, the *common ratio*; "count the arrows, not the cells". Every film in the exponential-model skill opens with the three things to find: **start** (the amount at the first count), **factor** (given, hidden in a percent, or found by dividing neighbors), **step** (one unit, or a stretch).

---

### `geometric-sequence-rule` — Ratio, missing term or later term from some terms

**Standard.** HSF.LE.A.2: "Construct ... geometric sequences, given ... two input-output pairs (include reading these from a table)." HSF.BF.A.2 in use (the explicit formula). The catalog's HSF.IF.A.2 is a stretch.

**Foundations first.** The skill's opening build, on the table variant's own numbers: 81, 54, 36, 24 in the step table. Divide across each arc: 54/81 = 2/3, 36/54 = 2/3, 24/36 = 2/3; the ratio is 2/3 (that variant is now answered, in passing). Bars to scale under the cells, each bar's ghost showing it is two thirds of the one before. Then the two moves: forward is ×r per arrow; backward is ÷r per arrow. A long arc over k arrows carries ×r^k.

**Read.** Which is asked: the ratio, a term ahead, a term behind, or a term between? What is given: neighbors (divide once), or terms k arrows apart (divide, then the kth root)? At a glance: the sign pattern says whether r is negative (the values alternate); the size of the quotient bounds |r|.

**The example.** "A geometric sequence has a_2 = −10 and a_5 = 80. What is a_1?" (1) Table with cells 1 to 5; −10 under 2, 80 under 5, bars to scale, 80 pointing up, −10 hanging below. (2) Count the arrows from 2 to 5: three, said aloud as they go gold one by one. (3) A long arc over the three: ×r³. Divide across it: 80 ÷ (−10) = −8, so r³ = −8. (4) The sign: the value flipped across the baseline, so r is negative; 2³ = 8, so r = −2; the three small arcs fill in ×(−2). (5) a_1 is one arrow back from a_2: divide. −10 ÷ (−2) = 5; the bar for cell 1 grows, standing up, height 5. (6) Prove it forward: 5, −10, 20, −40, 80; each cell lights as it is said.

Quick second case (a different act: the root with a sign choice): "4, ?, 16 are consecutive terms, positive terms." Two arrows: r² = 16/4 = 4; r = 2 because the terms are positive (gold on "positive"); the missing term is 4 × 2 = 8. One beat: 10 would be the arithmetic middle, equal differences (+6, +6), and the ratios 10/4 and 16/10 are not equal.

Quick third case (the recursive rule read forward): a_1 = 32, a_n = −1.5 a_{n−1}, a_5: four arrows: 32, −48, 72, −108, 162, bars flipping each step.

**Fast.** Neighbors: divide later by earlier. k arrows apart: divide, then the kth root; the sign of the quotient gives the sign of r when k is odd. Forward: multiply per arrow; back: divide per arrow.

**Sense.** r must flip the sign if the values alternate; |r|³ = 8 means |r| is small, so a_1 is about the size of a_2.

**Check.** Multiply from the answer to the given terms, one arrow at a time.

**Line.** "Count the arrows, not the cells."

**Trap.** Treating the quotient of two distant terms as the ratio (r = −8), or counting cells (a_2 to a_5 as four arrows, r⁴). The long arc sits over exactly three small arcs, and the small arcs are only filled in after the root. For the middle term: averaging (10). The differences row shows +6, +6 belongs to the blue, linear picture, not this one.

**Kit.** `steps` gains a spanning arc (`s.span` from col i to col j with TeX) that sits above the small arcs and can be relabeled by `divide`. Nothing else.

**Writer.** A capable cheaper model: every case is defined here, the picture is one `steps` chart, and the math check catches arithmetic.

---

### `geometric-sequence` — Term n from the first term and the ratio

**Standard.** HSF.BF.A.2 (the explicit formula used) and HSF.IF.A.3 ("sequences are functions ... whose domain is a subset of the integers").

**Foundations first.** The skill's opening build, then the direct rule said from the arrows: term n is n − 1 arrows from term 1, so a_n = a_1 · r^(n−1). "The first term has not been multiplied yet": the bar under cell 1 has no ghost.

**Read.** Three facts: first term, ratio, which term. "The first term is term 1" (gold) says the count starts at 1. At a glance: the exponent is one less than the term number; ratio above 1 means the answer is bigger than the start, below 1 smaller.

**The example.** "First term 7 and common ratio 2. What is term 7?" (1) Cells 1 to 7, 7 in cell 1, its bar. (2) Arrows counted aloud from 1 to 7: six. (3) a_7 = 7 · 2⁶; 2⁶ = 64 (six ×2 arcs); 7 × 64 = 448. (4) Fill the cells to prove it: 14, 28, 56, 112, 224, 448; the bars outgrow the frame and the camera pulls back; the early bars flatten. The pull-back is the first time the learner sees what doubling does; one line about it, no more.

Quick second case (the factor hidden in a word): "A pattern starts at 48. Each term is the previous term divided by 4. What is term 3?" Divided by 4 is ×1/4; two arrows; 48, 12, 3. The decoy 48 · 4² = 768 fails the direction check: dividing makes it smaller.

**Fast.** a_1 · r^(n−1). Count the arrows if n is small enough to say; use the power when it is not.

**Sense.** Doubling six times is ×64, so term 7 is about 450, and bigger than 7. For the quick case: smaller than 48.

**Check.** Multiply from 7 one arrow at a time and land on 448 at cell 7; or divide 448 by 2 six times back to 7.

**Line.** "Term n is n minus one arrows from term 1."

**Trap.** 7 · 2⁷ = 896: counting cells. The seven cells and six arrows are both on screen, and the arrows are counted aloud.

**Kit.** `steps` with `fit` (the pull-back). Nothing new.

**Writer.** Cheaper model; one method, one picture.

---

### `geometric-sequence-as-function` — The sequence as a function of its position

**Wording to fix first.** The app says a(4.5) is "undefined". The intent is that 4.5 is not a position, so there is no term; the lesson says "not in the domain, so there is no term there" and reads the app's word once as meaning that. (With base −3, (−3)^3.5 is also not a real number; that is a different fact and the lesson does not teach it.)

**Standard.** HSF.IF.A.3: "Recognize that sequences are functions ... whose domain is a subset of the integers." HSF.IF.B.5 ("the positive integers would be an appropriate domain"), HSF.IF.A.2 (evaluate for inputs in the domain).

**Foundations first.** Define: a function takes an input and gives one output; here the input is the *position* n and the output is the term, written a(n) instead of a_n (same thing, function clothes). Build with a(n) = 5 · 3^(n−1): the step table with positions 1, 2, 3, 4 and terms 5, 15, 45, 135; then the bar tops hand off to axes as separate dots at (1, 5), (2, 15), (3, 45). Nothing is drawn between them. Ask: what is the term between the second and the third? The camera pushes in on the empty space at n = 2.5; there is no position two and a half, so no dot and no term. The domain is the positions: 1, 2, 3, ... That build answers three of the six variants (domain, graph description, "which expression is undefined") and the lesson says so as it dims their decoys: "a continuous curve", "a ray", "every half step" all put points where no position is; "−1, −2, −4, ..." is a list of outputs, not inputs; "all real numbers n ≥ 1" is the ray again.

**Read.** Is the question about an input (domain, undefined, graph) or an output (a(3), is −5 a term)? At a glance: any non-whole input is out; any output question is settled by the two neighboring terms.

**The example.** "a(n) = −2 · 2^(n−1). Is −5 a term?" (1) Table: a(1) = −2, a(2) = −2 · 2 = −4, a(3) = −2 · 4 = −8; bars hang below the baseline, each twice the last. (2) −5 sits between −4 and −8 on the amount scale: a dashed line at −5 crosses between the bars for positions 2 and 3. (3) Between position 2 and position 3 there is no position. (4) No: −5 is not a term. Rule out: "a(2) = −5" and "a(3) = −5" are false by the table; "some input between 2 and 3" is the empty space.

Quick second case (an output asked): "a(n) = 4 · 4^(n−1). What is a(3)?" n − 1 first: 2; 4² = 16; 4 · 16 = 64. The decoys: 16 is 4² alone (forgot the first term), 256 is 4 · 4³ (used n), 1024 is 4⁵. Two arrows from 4: 16, 64.

**Fast.** Inputs: whole positions only. Outputs: work n − 1 first, then the power, then the first term. "Is it a term?": find the two terms it falls between; if it is not one of them, no.

**Sense.** The terms only go one way (here down), so one check between two neighbors settles it.

**Check.** The two neighbors on the table; a(3) proved by two arrows from a(1).

**Line.** "The inputs are positions. There is nothing between the dots."

**Trap.** Connecting the dots into a curve, and answering "yes, somewhere between 2 and 3": students bring the smooth-graph habit from functions. The empty space between dots, zoomed into, is the whole lesson. For a(3): 4 · 4³ (counting cells), made impossible by the two arrows.

**Kit.** `steps` `points` hand-off to `axes`; a dashed horizontal `seg` at the tested value; `dim` for sentence choices (wrapped pills exist).

**Writer.** Strongest: the choices are prose and the work is judgment about what is and is not on the graph.

---

### `geometric-rule-forms` — Step-by-step rule and direct rule (pilot 2)

**Standard.** HSF.BF.A.2 exactly: "Write ... geometric sequences both recursively and with an explicit formula ... and translate between the two forms." HSF.LE.A.2 (from two terms, from a description).

**Foundations first.** The two rules, both defined on one step table before any problem. Use the bounce: 2, 1, 1/2, 1/4, bars halving to scale. The *step-by-step* (recursive) rule says where to start and how to get the next from this one: a_1 = 2, a_{n+1} = (1/2) a_n; read aloud as "the next bounce is half this bounce", and the arrow is drawn from a_n to a_{n+1}, left to right. The *direct* (explicit) rule jumps: a_n = 2 · (1/2)^(n−1), the exponent being the number of arrows from term 1. Both rules, one table, one meaning. Test both at n = 1 and n = 2 and watch them agree with the cells. The start check and the one-step check are named here and used in every example.

**Read.** Which form is asked, and what is given: two terms in a row, a story, or the other form? At a glance: the start is the number in front of the direct rule (because r⁰ = 1), and the factor is its base; a story numbered "at hour 1" or "first bounce" starts at a_1.

**The example.** "a_2 = −6 and a_3 = −9. Which explicit rule gives a_n?" (1) Cells 2 and 3 filled, bars hanging. (2) Divide across the arc: −9 ÷ (−6) = 3/2. (3) One arrow back to a_1: −6 ÷ (3/2) = −4; its bar appears. (4) a_n = −4 · (3/2)^(n−1). (5) Start check: n = 1 gives −4 · 1 = −4. One-step check: n = 2 gives −4 · 3/2 = −6. Rule out, in one beat with the reason: the exponent n gives −6 at n = 1, which is a_2's value in a_1's seat (off by one); n − 2 gives −4 · 2/3 at n = 1; −6 in front starts in the wrong cell (n = 2 gives −9). All three fail the start check.

Second example, fully worked because translating is a different act: "a_n = 6 · (−3)^(n−1). Which recursive rule describes the same sequence?" Read the start off the front: 6. Read the factor off the base: −3. a_1 = 6, a_{n+1} = (−3) a_n. Table 6, −18, 54 from both rules, bars flipping. Rule out: a_n = (−3) a_{n+1} points the arrow backward ("this term is negative three times the next": from 6 it gives −2, 2/3, ...); a_n + (−3) adds (equal differences, the blue picture); a_1 = −3 swaps start and factor.

Quick third case (a story): "5 cells at hour 1, times 2 each hour": a_1 = 5 (gold on "at hour 1"), a_{n+1} = 2 a_n. Three beats.

**Fast.** Start and factor, then: recursive is "start, and next = factor × this"; explicit is start · factor^(n−1). From two neighbors, divide for r and divide back for a_1.

**Sense.** The direct rule at n = 1 must give the first term with no multiplying.

**Check.** n = 1 and n = 2 in whatever you wrote, against the table.

**Line.** "The first term has not been multiplied yet: n minus one."

**Trap.** The exponent n (the commonest wrong answer on this type), killed by the start check in one second. The backward recursion a_n = r a_{n+1}, which students accept because the symbols look right: the lesson reads it as a sentence and draws its arrow pointing left.

**Kit.** `steps` `divide`, arrows highlighted one by one, `dim`. Nothing new.

**Writer.** Strongest: this is where the two rules are defined for the skill and where the off-by-one is argued, not computed.

---

### `depreciation-recursion` — A percent lost, as a step-by-step rule

**Standard.** HSF.BF.A.2 (recursively) with HSF.LE.A.1c: "a quantity grows or decays by a constant percent rate per unit interval."

**Foundations first.** The percent bar, once: a bar for 100% of this year's value; cut at the percent; the lost share slides off in rust, the kept share stays teal and *is* next year's value. "Lose 10 percent: keep 90: times 0.9." The kept share as a decimal is the factor. Then the rule's shape, read aloud: a_1 is the value at the start of year 1 (nothing lost yet: the purchase price), and a_n = (factor) a_{n−1} says "this year is the factor times last year".

**Read.** Two wordings for the factor: "loses p%" (subtract from 100 first) and "worth p% of the year before" (p is already the kept share). The purchase price is a_1 because a_n is the value "at the start of year n" (gold). At a glance: the factor is a decimal between 0 and 1 and the rule multiplies; anything that adds, subtracts or grows is out.

**The example.** "A tractor bought for 18,000 dollars loses 10% of its value each year. a_n is its value at the start of year n. Which recursive rule?" (1) The bar for 18,000 cut at 10%: 1,800 leaves in rust; 16,200 stays. Keep 90%: ×0.9. (2) a_1 = 18000. (3) a_n = 0.9 a_{n−1}. (4) The staircase: 18,000, 16,200, 14,580; each loss (1,800, then 1,620) is 10% of a smaller bar, so the losses shrink. Rule out together: a_{n−1} − 0.1 takes ten cents off a tractor; 0.1 a_{n−1} keeps the lost tenth and throws away the rest; 1.1 a_{n−1} makes it worth more each year.

Quick second case: "A piano bought for 2,400 is worth 88% of its value from the year before." The 88 is the kept share, handed over: a_1 = 2400, a_n = 0.88 a_{n−1}. Rule out: 0.12 is the lost share; a_{n−1} − 0.12; 1.12.

**Fast.** Kept share as a decimal; start = price; multiply.

**Sense.** One step from 18,000 at 0.9 is 16,200, which is 18,000 with 1,800 gone: the right amount for 10%.

**Check.** One step by multiplying and one by subtracting 10% agree.

**Line.** "A percent is a factor: keep what is left."

**Trap.** The percent as the multiplier (0.1), and subtracting the percent as a number (−0.1). The cut bar makes both visible nonsense: 0.1 keeps the rust piece, and −0.1 takes a dime off.

**Kit.** `bar` with a `cut` that slides the lost share off (the family's `cut`), `steps` staircase, `dim`. Nothing new.

**Writer.** Cheaper model; one method, every decoy named.

---

### `geometric-signed-term` — A later term with a negative ratio

**Standard.** HSF.BF.A.2 (explicit formula) and HSF.IF.A.3.

**Foundations first.** The skill's build, then one fact from family 3 named, not re-taught: a negative times a negative is positive, so a negative factor flips the sign every arrow. On the staircase a negative factor flips the bar across the baseline each step. Decide the sign by counting the flips: an odd count ends on the other side of where you started, an even count on the same side.

**Read.** The ratio's sign comes from dividing later by earlier, with signs. Term n is n − 1 arrows away. At a glance: with a negative ratio, the sign of a_n is decided before any size is computed; with negative terms and a positive ratio, every term is negative.

**The example.** "a_1 = −1, each term is −4 times the term before. What is a_4?" (1) Cell 1: −1, a small bar hanging below. (2) Three arrows to cell 4; each flips: −1 (below), 4 (above), −16 (below), 64 (above); the bars grow and swap sides, and the camera pulls back. (3) Sign first: three flips from below land above: positive. (4) Size: 4³ = 64. (5) a_4 = 64. Rule out together: −64 forgot the first term's sign (or the third flip); −256 is a fourth arrow (counting cells); −13 is −1 + 3(−4), adding.

Quick second case (negative terms, positive ratio): "−3, −9, −27, ... What is a_4?" Divide across: (−9)/(−3) = 3: the ratio is positive, the bars all hang below and just get longer; a_4 = −27 · 3 = −81. Rule out: 81 flipped a sign that never flips; −243 is a_5; 6 is a difference.

**Fast.** Sign of r^(n−1) first (odd power of a negative is negative), then a_1's sign, then the size.

**Sense.** The flips: three flips from a hanging bar end standing up.

**Check.** Multiply through one arrow at a time, saying each sign.

**Line.** "Count the flips: odd changes the sign, even keeps it."

**Trap.** Losing the sign somewhere in three multiplications, and assuming negative terms mean a negative ratio. The bars flip or do not flip; the picture decides the sign before arithmetic starts.

**Kit.** `steps` with bars below the baseline and the flip motion on `step`. Nothing new.

**Writer.** Cheaper model.

---

### `exponential-model-value` — A later value from a table, a percent, a half-life or a formula

**Fix first.** The expected "11535.00" must also accept 11535 and 11,535. Also: this type rounds once, at the end (8,800 × 1.07⁴ = 11,535.0049 → 11,535.00), while `interest-compare-years` rounds each year's interest to the cent; rounding each year here gives 11,535.01, which this checker marks wrong. Each problem's text already says which; the lessons follow the text and say the difference once.

**Standard.** HSF.LE.A.2 ("given ... a description of a relationship, or two input-output pairs (include reading these from a table)"), HSF.LE.A.1c (constant percent rate), HSF.BF.A.1a ("an explicit expression ... from a context"). The catalog's HSA.CED.A.1 is loose.

**Foundations first.** The three things, defined and drawn: start, factor, step. Then value = start × factor^(arrows), on the step table with the step size written on the muted top arcs (+1 year, +4 hours) and the factor on the amount arcs. The percent bar once: "earns 7%" is ×1.07, "loses 6%" is ×0.94. Four input shapes are coming; the lesson says so, and says that all four end in the same picture.

**Read.** Find the three things and go gold on the word that gives each ("halves", "every 4 hours", "after 12 hours", "7% ... each year"). At a glance: direction (grows or shrinks), the number of arrows (time ÷ step length), rough size.

**The example.** "An 88 mg dose halves every 4 hours. How many mg remain after 12 hours?" (1) Start 88 (gold "88 mg"). Factor 1/2 ("halves"). Step 4 hours ("every 4 hours"). (2) The table's top row: 0 h, 4 h, 8 h, 12 h with +4 h arcs; 12 ÷ 4 = 3 arrows, counted. (3) 88 × (1/2)³ = 88/8 = 11. (4) Staircase 88, 44, 22, 11, each bar half the ghost. The decoy named: twelve halvings would need a step of one hour.

Second example, fully worked because a percent to the cent is a different act: "8,800 dollars earns 7% a year. After 4 years? Round to the nearest cent." (1) Start 8,800; factor: keep 100% and add 7%: 1.07; step one year; 4 arrows. (2) 8800 × 1.07⁴. (3) 1.07⁴ = 1.31079601 (board, ≈ accepted); × 8800 = 11,535.0049; rounded once at the end: 11,535.00. (4) Sense beat on the board: adding 7% four times would be 28%, 11,264; the real answer is more because each year's 7% is on a bigger balance; the staircase shows the gains 616, 659.12, 705.26, 754.62 growing.

Quick cases, own screens: the table (x 0 to 3; y 3, 6, 12, 24: divide across for ×2, a = 3 at x = 0, six arrows to x = 6: 3 · 2⁶ = 192); the decay to the cent (4,500 × 0.94¹⁰ = 2,423.77; ten arrows is a power, not ten multiplications by hand).

**Fast.** start × factor^(time ÷ step); the percent as a kept share; round where the problem says.

**Sense.** Direction and rough size: three halvings is ÷8; 7% for four years is a bit more than 28%.

**Check.** Small counts: multiply through (88, 44, 22, 11). Large: divide the answer back by the factor once and compare with the previous year's value.

**Line.** "Start, factor, step. Then count the arrows."

**Trap.** 12 halvings for 12 hours (the step is 4 hours, drawn on the arcs), adding the percent four times (28%), and multiplying by 0.07. The time row with its +4 h arcs, and the percent bar, make each wrong.

**Kit.** `steps` with a labeled top-arc row (`stepArc` per column); the board math check accepting ≈ with stated rounding. Nothing else new.

**Writer.** Strongest: four input shapes under one name, and the lesson teaches reading them.

---

### `exponential-model-rule` — Choose y = a · b^x for a table, a graph or a story (pilot 1)

**Standard.** HSF.LE.A.2 exactly: "Construct linear and exponential functions ... given a graph, a description of a relationship, or two input-output pairs (include reading these from a table)." HSF.LE.A.1 (the linear decoy: distinguish).

**Foundations first.** The family's picture is born here, from the table variant's own numbers before any problem is posed. Table x 0, 1, 2, 3; y 4, 12, 36, 108. Draw two arc rows under the amounts: differences +8, +24, +72 (not constant: not a line) and ratios ×3, ×3, ×3 (constant: exponential). Define y = a · b^x: a is the value at x = 0 (b⁰ = 1, so nothing has been multiplied yet) and b is the factor each step. Staircase bars to scale with ghosts. Say the lineage once: the ×3 on the arc is the +10 on the grade-1 arc; count arrows, not cells.

**Read.** Where is x = 0? That is a. What multiplies each step? That is b, from dividing neighbors, from a percent, or from a word ("triples"). At a glance: a story with "percent" or "times" is exponential, so any linear or power choice is gone; the start check kills swapped a and b.

**The example.** "The table shows an exponential function. Which equation gives y for every row?" (the table above). (1) a = 4 (the x = 0 row goes gold). (2) b = 3 (divide across one arc; the others agree). (3) y = 4 · 3^x. (4) Check *every* row: 4, 12, 36, 108. (5) Rule out, each with its reason: 12 · 3^x gives 12 at x = 0 (fails the start); 3 · 4^x gives 3 at x = 0 and 12 at x = 1, then 48 (fails row 2); 8x + 4 gives 4 and 12, then 20 (fails row 2; equal differences of 8 against the growing differences on the arc). The lesson says why every row is checked: a decoy is built to pass two.

Second example, fully worked because a percent in a story is a different reading: "A car is worth 30,000 dollars and loses 10% of its value each year. Which equation gives its value after x years?" (1) a = 30,000 ("is worth"). (2) The percent bar cut at 10%: keep 90%: b = 0.9. (3) y = 30000 · 0.9^x. (4) Staircase 30,000, 27,000, 24,300: the second loss is 2,700, not 3,000. Rule out: 30000 − 3000x loses the same 3,000 every year (equal differences); 0.1^x keeps the lost share; 1.1^x grows.

Quick cases: "starts with 5 thousand cells and triples every hour": a = 5, b = 3, y = 5 · 3^x; 3 · 5^x fails the start (3 at x = 0); 5 + 3x adds; 5x³ is a power of x, not of a factor. The graph variant: read a at x = 0, divide the next point by it; the same method, one screen, three beats.

**Fast.** a from x = 0; b by dividing one arrow (or the kept share of a percent); check every row.

**Sense.** At x = 0 the rule gives a; one step gives the second value.

**Check.** Every given row; for a story, the first two years by hand.

**Line.** "a is where you start; b is what you multiply by each step."

**Trap.** Swapping a and b (3 · 5^x): the start check. A linear rule that fits two points (8x + 4): the third row and the differences arc. The percent as the multiplier: the cut bar.

**Kit.** `steps` with a differences row (`diffs: true`), `cut`, `dim`; the graph variant uses dots on `axes`. Nothing beyond the family's list.

**Writer.** Strongest: the family's picture and its words are defined here for every lesson after it.

---

### `rg-exponential-base-rate` — The percent and the stretch read from a base (pilot 3)

**Standard.** HSF.IF.C.8b exactly: "identify percent rate of change in functions such as y = (1.02)^t, y = (0.97)^t, y = (1.01)^{12t}, y = (1.2)^{t/10}, and classify them as representing exponential growth or decay." HSF.LE.B.5 (interpret the parameters).

**Foundations first.** Reading a factor backward: 1.06 is 100% plus 6%, growing by 6%; 0.94 is 100% minus 6%, losing 6% (not losing 94%); the percent bar shows each. Then the timeline: a horizontal time line with the stretch in the exponent as the span of one factor arc. For b^(t/3), one ×b arc covers three years, and t years hold t/3 arcs. "The percent belongs to the stretch in the exponent." Test at t = 3: one arc, one multiplication.

**Read.** Three things in the formula: the base (direction and percent), the exponent's denominator (the stretch), the number in front (the start, not asked here). At a glance: base above 1 throws out every "decreases"; a denominator under t throws out every "each year".

**The example.** "Q(t) = 800(1.06)^(t/3), t in years. Which statement is true?" (1) Base 1.06 > 1: grows; 1.06 − 1 = 0.06: 6%. (2) Exponent t/3: the timeline shows one ×1.06 arc spanning 0 to 3 years, the next spanning 3 to 6. (3) Test t = 3: Q(3) = 800 × 1.06¹ = 848: one rise of 6% in three years. (4) "It increases by 6% every 3 years." Rule out together: "6% each year" would be 1.06^t, three arcs in three years; "decreases" is a base below 1; "18% every 3 years" adds 6% three times, and even three real 6% rises would be ×1.06³ ≈ 1.191, not 18%, and the model has only one.

Second example, fully worked because decay is read by subtracting from 1 and its decoy is the kept share: "V(t) = 2500(0.757)^t, t in years. Which statement describes how it changes each year?" Base below 1: decreases. The percent is the lost share: 1 − 0.757 = 0.243: 24.3% a year. The bar: 75.7% kept, 24.3% cut off in rust. Rule out: 75.7% is the kept share; 0.757% reads the decimal as a percent; "increases" is the wrong direction.

Quick third case (building, not reading): half-life 4 hours, 500 mg: factor 0.5, stretch 4 hours: A(t) = 500(0.5)^(t/4); the timeline with ×0.5 arcs every 4 hours. Rule out: 0.5^t halves every hour; 0.5^(t−4) is a shift, not a stretch; 2^(t/4) grows.

**Fast.** Base − 1 (or 1 − base) as a percent; the denominator under t is the stretch; the percent belongs to that stretch.

**Sense.** Test t at one stretch: one multiplication by the base.

**Check.** Write the factor back from the chosen percent and compare with the base.

**Line.** "The percent belongs to the stretch in the exponent."

**Trap.** Reading 6% as yearly when the exponent is t/3, and multiplying the percent by the stretch (18%). The arc spanning three years on the timeline. For decay: 75.7% as the decrease. The rust piece is the decrease.

**Kit.** `numberline` factor arcs with `span` and a `mark` for t; `bar` cut; `dim`. Nothing else.

**Writer.** Strongest: a pilot film that defines the timeline for `growth-model-rewrite` and `compound-growth`.

---

### `interest-compare-years` — Simple against compound, in exact cents

**Fix first.** The long sentence choices clip in the prompt text; confirm they render whole in the app and in the film's wrapped pills. The rounding rule is part of the problem (each year's interest rounded to the cent): 2,000 at 8% for 4 years is 2,720.97 rounded yearly, but 2,720.98 if computed as 2000 × 1.08⁴; the checker wants the first. The lesson follows the text.

**Standard.** HSF.LE.A.1b and c: "one quantity changes at a constant rate per unit interval" (simple interest: the same dollars every year) and "grows ... by a constant percent rate per unit interval" (compound: the same percent of a growing balance). HSF.LE.A.3 in spirit (compound eventually exceeds simple at the same rate). 7.RP.A.3 ("simple interest") is the foundation.

**Foundations first.** Two accounts defined by what happens each year, on the family's vertical table (year | A | B) from the first variant: 4,000 at 3%. *Simple*: interest on the original deposit only, so the same 120 every year; blue +120 arcs beside column A; equal differences, the line. *Compound*: interest on the balance you have, so the interest grows: beside column B the differences 120, 123.60, 127.31, 131.13 and the teal arcs ×1.03 (nearly, because each year's interest is rounded to the cent). "The test is the differences: equal means simple; growing means compound." Said once: at the same rate, the two agree after year 1 and compound leads from year 2 on; at different rates either can lead, so read, do not assume.

**Read.** Which is asked: which account is compound, the gap after n years, the gap in one year's interest, or which holds more at different rates? At a glance: "holds more" is a balance; "earns more interest during year 2" is one year's gain; the gap after 4 years is read on the year-4 row, not year 3.

**The example.** The table variant. (1) Differences written on both columns as above. (2) A's are all 120: simple. B's grow: compound. (3) Gap after 4 years: 4,502.04 − 4,480.00 = 22.04, stacked on the point. (4) "Account B earns compound interest; after 4 years it holds 22.04 dollars more." Rule out: both "Account A ... compound" fail the differences test; 10.91 is the year-3 gap (4,370.91 − 4,360.00).

Second example, fully worked because computing with yearly rounding is a different act: "Two accounts each start with 2,000 dollars at 8%. S pays simple interest; C pays compound, each year's interest rounded to the nearest cent. After 4 years, how much more does C hold?" (1) S: 8% of 2,000 is 160; four years is 640; 2,640. (2) C, year by year in the vertical table, each interest computed and rounded, each addition a stack: 160.00 → 2,160.00; 172.80 → 2,332.80; 186.624 → 186.62 → 2,519.42; 201.5536 → 201.55 → 2,720.97. (3) 2,720.97 − 2,640.00 = 80.97. Rule out: 640 is S's interest, 720.97 is C's interest, 2,720.97 is a balance; the question asks the gap between balances.

Quick cases, own screens: "during year 2, how much more interest does C earn" (2,500 at 2%): S earns 50 every year; C's year-2 interest is 2% of 2,550 = 51; one dollar more (the decoys are the two interests and a balance). Different rates (1,500: 5% simple against 3% compound, 2 years): 1,650 against 1,591.35; A holds 58.65 more; the rate matters more than the kind over two years.

**Fast.** Simple: one year's interest times the years, plus the deposit. Compound: year by year, rate × current balance, rounded, added. Then subtract.

**Sense.** At the same rate compound is ahead from year 2 on, and the gap after 4 years at 8% is a few percent of 2,000, tens of dollars, not hundreds.

**Check.** Each year's balance minus the one before is that year's interest; the gap equals compound interest minus simple interest (720.97 − 640).

**Line.** "Simple: the same dollars each year. Compound: the same percent of a growing balance."

**Trap.** Calling the bigger balance compound without the differences test (fails when rates differ); answering a balance or an interest total when the gap is asked; reading the year-3 row; and 2000 × 1.08⁴ = 2,720.98, one cent off, because the problem's yearly rounding was skipped. Every year is rounded on screen.

**Kit.** `steps` vertical layout with two amount columns, each with its own arc kind and ink; `stack` with headers for the cent arithmetic; the board math check accepting a rounded line (186.624 → 186.62). Nothing else.

**Writer.** Strongest: four kinds of question, prose choices, and the judgment of which test decides.