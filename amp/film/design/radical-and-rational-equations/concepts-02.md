# Rational and rational-expression types: lesson concepts

From the family design. Each stands on the restriction card, the "times zero" idea and the two pictures defined there; a concept names the foundation it uses and does not re-teach it. Across all nine: the card is written before any step, every candidate falls and is judged, and rust means forbidden or invented.

---

## Rational expressions (`rational-expressions`, Algebra 2)

### `rational-expression-simplify` — Simplify and keep every exclusion

**Standard.** HSA.SSE.A.2, "use the structure of an expression to identify ways to rewrite it," and HSA.APR.D.6, "rewrite simple rational expressions in different forms." The catalog's link to APR.D.7 (operations on rational expressions) is wrong for this type; no operation between two fractions happens here.

**Foundations first.** Three definitions, drawn, before the example. (1) An *excluded value* is an input where the bottom is zero, so the fraction has no value there (foundation 7: 6 ÷ 0 has no answer). (2) On the graph, an excluded value is a *wall* if its factor stays, a *hole* if its factor cancels; both are excluded (foundation 9). (3) "Simplify" means rewrite so that every allowed input gives the same value; it never makes a forbidden input allowed. The number twin says why only factors cancel: (2 · 6)/(2 · 8) = 6/8, but (2 + 6)/(2 + 8) is 8/10, and crossing out the 2s there gives 6/8, which is false. "Cancel factors, never terms."

**Read.** "Retain every exclusion" (gold) says the answer is two things: a fraction and a set. At a glance: the bottom x² + 5x + 4 has two factors, so the set has two numbers; any choice listing one is gone before any factoring.

**Example.** Simplify (−2x² − 2x + 24)/(x² + 5x + 4); choices as the app shows them. (1) Factor the bottom first: (x + 1)(x + 4). Card: x + 1 = 0 so x ≠ −1; x + 4 = 0 so x ≠ −4 (the sign slip is written out, not just the answer). (2) Picture: before any curve, two rust marks at x = −1 and x = −4. (3) Factor the top: pull −2 out first, −2(x² + x − 12) = −2(x + 4)(x − 3); the board writes the pulled −2 in its own beat, since factoring with a negative lead is where hands slip. (4) The pair (x + 4) fades from top and bottom together; on the graph the curve y = (−2x + 6)/(x + 1) is drawn with a wall at −1 and a hollow rust dot at (−4, −14/3), which stays. (5) Result: (−2x + 6)/(x + 1), excluded {−4, −1}, the set copied from the card.

**Fast.** Factor the bottom, write the card, factor the top (negative or common number out first), cancel whole factors, copy the card. Always works.

**Sense.** One safe value, x = 0: original 24/4 = 6; simplified 6/1 = 6. Same number.

**Check.** The safe value, plus: top and bottom have not swapped, and the canceled factor's zero is still on the card.

**Rule out.** {−1} alone: two factors on the bottom, gone at the card. (x + 1)/(−2x + 6) with {−4, −1, 3}: flipped, and 3 is a zero of the top, not the bottom. The last two differ by one constant, 6 against 8; x = 0 decides: 6, not 8. They dim together with their one reason each.

**Line.** "Cancel factors, never terms. The hole stays."

**Trap.** Crossing out the x² terms, and dropping −4 because its factor left the board. The twin (2 + 6)/(2 + 8) kills the first; the hollow dot that does not move when the factor fades kills the second.

**Kit.** `walls`, `holes`, `restrict` as specified. Add a board action that fades a matched factor pair on top and bottom together in one beat (`{"do":"cancel","factor":"x+4"}`), since `\cancel` strikes and strikes are for mistakes.

**Writer.** Strongest. The factoring with a negative lead, the fade that leaves the hole, and decoys differing by one constant or one exclusion need staging by someone reasoning about what each decoy means.

---

### `rational-expression-operation` — Add, subtract or multiply fractions with letters

**Standard.** HSA.APR.D.7 (+), "add, subtract, multiply, and divide rational expressions"; the app never divides, so that clause is unpracticed.

**Badly conceived, say first:** the choices print zero terms ("0x + 20"). The lesson writes 20, and the app should omit zero terms. The film must say once that the app's "0x + 20" means 20, or the learner cannot match the answer.

**Foundations first.** Foundation 10 in one line with its proof: fractions with letters are fractions. The lesson writes 4/2 − 4/7 in the muted twin column and says the rule the student has known since grade 5: same bottom, then the tops; to multiply, straight across. Then: the common bottom is each distinct factor once. The restrictions are given in the problem; the lesson says why they are still true after combining (nothing forbidden becomes allowed).

**Read.** "Which expression equals ... for all allowed inputs" (gold): the answer is a single fraction that agrees with the original at every allowed x. At a glance: the restrictions name the factors the bottom must still have.

**Example 1 (subtract).** 4/x − 4/(x + 5), x ≠ 0, x ≠ −5. (1) Card: x ≠ 0, −5. (2) The bottoms are different: common bottom x(x + 5). (3) Multiply each fraction top and bottom by the missing factor, twin beside: 4(x + 5)/(x(x + 5)) − 4x/(x(x + 5)) alongside 4 · 7/(2 · 7) − 4 · 2/(2 · 7). (4) Same bottom, subtract the tops: (4x + 20 − 4x)/(x(x + 5)) = 20/(x(x + 5)); twin (28 − 8)/14 = 20/14. (5) The twin check: 4/2 − 4/7 = 2 − 4/7 = 10/7, and 20/14 = 10/7.

**Example 2 (multiply): a different method.** (x + 5)/x · 7/(x + 5). Straight across: 7(x + 5)/(x(x + 5)); the factor (x + 5) fades top and bottom; 7/x; the card still says x ≠ −5. Twin at x = 3: 8/3 · 7/8 = 56/24 = 7/3, and 7/3 = 7/x. Addition (4/x + 2/(x + 4)) is example 1 with a plus; it needs no screen.

**Fast.** Add or subtract: each bottom times what it lacks, then tops. Multiply: straight across, cancel factors. Always works.

**Sense.** The twin number agrees.

**Check.** One allowed value in the original and in the answer; the same number.

**Rule out.** A bottom that was added (2x + 5): gone, fractions never add bottoms. A bottom with a factor missing (just x) when nothing canceled: gone. The sign flipped: the twin's sign. For the product, "7" and "7/(x + 5)" each lost the wrong factor; the twin at x = 3 gives 7/3, not 7 or 7/8.

**Line.** "Fractions with letters are fractions: same bottom, then the tops."

**Trap.** Adding the bottoms, 4/x − 4/(x + 5) = 0/(2x + 5). The twin 4/2 − 4/7 beside it makes the absurdity visible: 0/9 is not 10/7.

**Kit.** `twin` as specified; `dim`.

**Writer.** Capable cheaper model: two methods, one example each, the twin paces itself; the only judgment is choosing a twin value where no decoy coincides (x = 1 makes "7" equal 7/x in example 2; x = 3 does not).

---

### `cubic-quotient-factored` — Divide a cubic by a linear factor, then factor the quotient

**Misfiled.** This is polynomial division, HSA.APR.D.6 ("using inspection, long division, or ... a computer algebra system") plus HSA.SSE.A.2 for factoring the quotient; it belongs in family 18 (`polynomial-division`). Design it here with the shared `longdiv` so family 18 inherits it. Every variant divides exactly, so the q(x) + r(x)/b(x) form is never practiced.

**Foundations first.** Division of a polynomial is numeric long division with place values replaced by powers of x: the standard layout, divisor left, dividend under the bar, quotient above term by term. One beat recalls 24 ÷ 3 = 8 in the same layout, then: the question "what times 2x gives 2x³" is the same question as "what times 3 gives 24." The condition "2x + 3 ≠ 0" is read: the bottom is not zero, so dividing is allowed, and the two expressions agree for every other x.

**Read.** "Equivalent to" (gold): a quotient with remainder zero. At a glance, two facts before dividing: the leading term is 2x³ ÷ 2x = x², so the quotient starts with x², not 2x²; the constant is 24 ÷ 3 = 8, so the factored quotient's constants multiply to 8.

**Example.** (2x³ − 9x² − 2x + 24) ÷ (2x + 3). `longdiv`, one beat per step: (1) 2x³ ÷ 2x = x², written above; x²(2x + 3) = 2x³ + 3x² under; subtract: −12x² − 2x, bring down. (2) −12x² ÷ 2x = −6x; −6x(2x + 3) = −12x² − 18x; subtract: 16x + 24. (3) 16x ÷ 2x = 8; 8(2x + 3) = 16x + 24; remainder 0, lit. (4) Quotient x² − 6x + 8 = (x − 4)(x − 2): two numbers that multiply to 8 and add to −6. (5) Answer (x − 4)(x − 2).

**Fast.** Long division; the quotient's lead and constant are known before you start, which catches a slip halfway.

**Sense.** The quotient is a quadratic (degree 3 minus degree 1) with lead x² and constant 8.

**Check.** Multiply back: (2x + 3)(x² − 6x + 8) = 2x³ − 12x² + 16x + 3x² − 18x + 24 = 2x³ − 9x² − 2x + 24. Said term by term.

**Rule out.** 2(x − 4)(x − 2): lead 2x², gone. (x − 4)(x + 2): constant −8, gone. (x + 4)(x + 2) has constant 8 but middle +6x; one value settles it: at x = 1 the original is 15/5 = 3, and (x − 4)(x − 2) is 3 while (x + 4)(x + 2) is 15.

**Line.** "Lead and constant first: they tell you where you must land."

**Trap.** A sign slip in the subtraction row (−9x² − 3x² written as −6x²). The layout draws the product under the dividend and the subtraction as its own row, so the signs are seen, not held in the head.

**Kit.** `longdiv` in its polynomial form, paced per step like `column`; `dim`.

**Writer.** Capable cheaper model: `longdiv` carries the method; the writer adds the two at-a-glance facts and the multiply-back.

---

## Rational equations with one denominator (`rational-equation-one-denominator`, Algebra 2)

Both films open with the card and foundation 8 in one picture: 3 ≠ 7, but 3 × 0 = 7 × 0. Multiplying both sides by a denominator multiplies by zero exactly at the excluded value, so there the cleared equation cannot tell true from false. "Before you clear, write what x can't be."

### `rational-extraneous-single` — One denominator, a candidate that may land in the hole

**Standard.** HSA.REI.A.2, "solve simple rational ... equations in one variable, and give examples showing how extraneous solutions may arise." The "give examples" clause is served by the film's picture, not by the problem.

**Foundations first.** The opening above, then the hole: (x² − 36)/(x − 6) factors to (x − 6)(x + 6)/(x − 6), which is x + 6 everywhere except at 6, where it has no value. Drawn: the line y = x + 6 with a hollow rust dot at (6, 12). This one picture is the whole lesson.

**Read.** "Over the real numbers. Which statement is correct?" (gold): the answer is a sentence about the solution set: one number, none, or everything allowed. At a glance: the card.

**Example 1.** Solve (x² − 36)/(x − 6) = 12, with its four choices. (1) Card: x − 6 = 0, so x ≠ 6. The choice "x = 6" dims now, before any algebra, with its reason. (2) Picture: the line with its hole, and the right side y = 12 drawn in blue, running straight through the hole. (3) Multiply both sides by (x − 6), rust margin note: x² − 36 = 12(x − 6) = 12x − 72; x² − 12x + 36 = 0; (x − 6)² = 0; candidate x = 6. (4) Drop and judge: the dot falls at 6; left side "no value"; it hollows and turns rust; on the card, `\cancel{x = 6}`. (5) Why: at x = 6 we multiplied both sides by zero, and 0 = 0 proves nothing. (6) No solution; the correct sentence is read aloud.

**Example 2 (the three-term shape, a candidate that survives).** (x + 6)/(x + 3) = −2 + 27/(x + 3). Card: x ≠ −3; "x = −3" and "x = 5 and x = −3" dim together. Multiply *every* term by (x + 3), each lit as it is multiplied: x + 6 = −2(x + 3) + 27 = −2x + 21; 3x = 15; x = 5. Judge: not −3; drop: left 11/8, right −2 + 27/8 = 11/8; the dot rises to the crossing and turns gold. x = 5.

**Quick case (the student's work).** "A student ... gets x = 5" for x/(x − 5) = 3 + 5/(x − 5). Card x ≠ 5; the candidate is the excluded value; the sides are two hyperbolas with the same wall that never meet. Decoys named: "because 5 is positive" (sign is nothing to do with it); "satisfies the cleared equation" (the cleared equation was multiplied by zero there); "a second solution" (clearing left a linear equation, one candidate at most).

**Fast.** Card; multiply every term; solve; judge against the card; check survivors in the original.

**Sense.** A line meets a horizontal line once; if that once is the hole, never. Two hyperbolas sharing a wall and an asymptote shape never meet.

**Check.** Substitute into the original and say both sides: "eleven eighths; eleven eighths."

**Rule out.** Any choice containing the excluded value dims at the card. "Every real number except" needs both sides to be the same expression; a line and a flat line are not.

**Line.** "Times zero, everything is equal. The original remembers."

**Trap.** Trusting the cleared equation, and multiplying only the fraction terms, leaving −2 alone. The drop that hollows ends example 1; the every-term lighting runs example 2.

**Kit.** `holes`, `walls`, `candidate`, `restrict`/`judge`, `dim`.

**Writer.** Strongest: the no-solution verdict must be argued from the picture, and the decoys are explanations.

---

### `rational-equation-one-denominator` — A constant over a linear denominator equals a constant

**Standard.** HSA.REI.A.2, "solve simple rational ... equations in one variable."

**Foundations first.** The shared opening, briefly: the card and why. Then the picture for this type: y = −9/(x − 1) is a hyperbola with a wall at x = 1 and a floor-and-ceiling line at y = 0 it never touches; y = −4 is a flat line. A flat line meets this curve exactly once, unless it sits at the height the curve never reaches.

**Read.** "Solve for x" with no choices: one number, probably a fraction. At a glance: −9 over something is −4, so the something is positive and x − 1 > 0, so x > 1; and −9/(x − 1) is never zero, so no candidate can ever land on the wall. The card is written anyway: it is the habit, and in the next lesson it bites.

**Example.** −9/(x − 1) = −4. (1) Card: x ≠ 1. (2) Picture: wall first, then the hyperbola in teal, then the blue line y = −4, one crossing to the right of the wall. (3) Multiply both sides by (x − 1), rust note: −9 = −4(x − 1). (4) Distribute, its own beat: −9 = −4x + 4; −13 = −4x; x = 13/4. (5) Judge: 13/4 is not 1; drop: x − 1 = 9/4, −9 ÷ 9/4 = −4; left −4, right −4; gold.

**Fast.** A number over a bottom equals a number, so the bottom is the first number divided by the second: x − 1 = −9 ÷ (−4) = 9/4, x = 13/4. Always works when neither constant is zero (every variant), and it skips the distribution where the sign slips. The lesson shows both ways once, the long one first.

**Sense.** x > 1 from the signs; 13/4 is 3.25. The crossing is right of the wall.

**Check.** Substitute: x − 1 = 9/4; −9 divided by nine fourths is −4.

**Line.** "A flat line meets the curve once: solve, then say where."

**Trap.** −9 = −4x − 4 (the sign not distributed), giving 5/4. The distribute step has its own beat; the sense check (x must be past 1) catches 5/4 anyway.

**Kit.** `walls`, `candidate`, `restrict`. Nothing new.

**Writer.** Capable cheaper model: one method, one number, one sense sketch.

---

## Rational equations (`rational-equations`, Algebra 2)

### `rational-equation-formulate` — Write the equation from a story

**Standard.** HSA.CED.A.1, "create equations ... in one variable ... include equations arising from ... simple rational ... functions"; HSN.Q.A.1, "choose and interpret units consistently in formulas." The clause "and use them to solve problems" is never practiced: the type stops at the equation. A formulate-and-solve variant would close it.

**A mixed type.** Three stories under one name: a current, two speeds adding to a total time, two workers together. There is no shared recipe; the lesson teaches reading, with one example per story.

**Foundations first.** Two ideas, each with its picture, before any story. (1) Time is distance over speed (families 10 and 14): the d–r–t table with units, miles ÷ miles per hour = hours; the units are written in the headers and the division is read as "miles over miles per hour." (2) A rate of work is the share of the job done in one hour (family 9): a bar for the whole job; a painter who finishes in 7 hours does 1/7 of the bar each hour.

**Read.** "Which equation models this" (gold): the answer compares two quantities of the same kind. The reading question for every story: *what is equal, and what adds?*

**Example 1 (current).** 30 miles downstream in the same time as 18 upstream, current 4, still speed x. Stop on "same time": the two times are equal. Stop on "current": it rides on the speed, x + 4 with, x − 4 against. Table filled cell by cell: down 30, x + 4, 30/(x + 4); up 18, x − 4, 18/(x − 4). Equal times: 30/(x + 4) = 18/(x − 4). Sense: in the same time, farther means faster, so 30 sits over the bigger speed.

**Example 2 (two speeds, total time).** 60 miles at x, 100 more at x + 15, the whole trip 3 hours. Stop on "the whole trip takes": the times add. Table: 60/x and 100/(x + 15); sum 3. Units: hours plus hours is hours; 3 is hours.

**Example 3 (work together).** 7 hours alone, 4 hours alone, together x. Bar: in one hour, 1/7 shaded, then 1/4 more; together they do 1/7 + 1/4 of the fence per hour, and finishing in x hours means 1/x per hour. 1/7 + 1/4 = 1/x. Sense: together is faster than the faster one alone, so x < 4.

**Fast.** None beyond reading. Ask what is equal and what adds; put the current on the speed; a time is a distance over a speed.

**Sense.** Farther in the same time means faster; a sum of hours equals hours; together beats alone.

**Check.** Read the chosen equation back as a sentence in the story's words: "thirty miles at x plus four miles per hour takes the same hours as eighteen at x minus four."

**Rule out.** Distance times speed (60x + 100(x + 15) = 3): miles times miles per hour is not hours. The current or the 15 added to a time instead of a speed. Swapped fractions (30 over the slower speed, with equal times). For work: rates multiplied, or hours added (7 + 4 = 1/x), or the sum set to x instead of 1/x (a rate equals a rate). Each dims with its one reason.

**Line.** "Time is distance over speed. With the current, add; against it, subtract."

**Trap.** The current added to the time, and the swapped fractions. The table with units makes the first impossible; "farther means faster" makes the second visible.

**Kit.** `table` exists; `bar` exists (shade 1/7 then 1/4 of one whole). `dim`.

**Writer.** Strongest: mixed stories with no recipe; the quality is in where the reading stops.

---

### `sat-entry-rational-equation` — Enter the solution of a rational equation

**Standard.** HSA.REI.A.2, "solve simple rational ... equations in one variable"; HSA.REI.B.4b, "factoring, as appropriate to the initial form." Two shapes: a fraction equal to zero, and two fractions equal.

**Foundations first.** The card and "times zero," briefly. Then the fact that runs the first shape: a fraction is zero exactly when its top is zero and its bottom is not. On the picture, (x² − x − 2)/(x − 2) is the line y = x + 1 with a hole at (2, 3): the zeros of the bottom are holes, the zeros of the top are where the graph meets the axis, and a number can be a zero of the top and still be a hole if the factor is in both. The entry rules in one beat: 23/10 or 2.3, never 2 3/10.

**Read.** "What is the solution" (gold) means one number; "sum of all real solutions" means find them all, judge each, then add. At a glance: a fraction equal to zero is asking about the top only, once the card is written.

**Example 1.** (x² − x − 2)/(x − 2) = 0. (1) Card: x ≠ 2. (2) Picture: hole at (2, 3), then the line; the right side y = 0 is the axis itself. (3) Top zero: (x − 2)(x + 1) = 0, candidates 2 and −1. (4) Judge: 2 is on the card, struck; drop: the dot at 2 finds a hole, not the axis; −1: left 0, right 0, gold at the crossing (−1, 0). (5) Enter −1.

**Quick case (the sum).** (x² + 11x + 30)/(x − 1) = 0: card x ≠ 1; top (x + 5)(x + 6); −5 and −6 both allowed; sum −11. The quadratic's sum of roots (−11) is a check, never the method: in example 1 it would have given 1 instead of −1.

**Example 2 (two fractions equal): a different method.** (x − 2)/(x − 3) = (x − 5)/(x + 4). Card: x ≠ 3, −4. Cross-multiply, said as what it is, both sides times both bottoms: (x − 2)(x + 4) = (x − 5)(x − 3); x² + 2x − 8 = x² − 8x + 15; the x² terms cancel; 10x = 23; x = 23/10. Judge: not 3, not −4; drop: left (3/10)/(−7/10) = −3/7, right (−27/10)/(63/10) = −3/7; gold. Enter 23/10 or 2.3.

**Fast.** Zero on one side: factor the top, strike anything on the card, enter what is left. Two fractions: card, cross-multiply, solve, judge.

**Sense.** A line with a hole meets the axis at most once; the hole is above the axis, so it was never a solution.

**Check.** Substitute and say both sides. For a sum, every term judged first, then added.

**Line.** "Zeros of the bottom are holes; zeros of the top are answers."

**Trap.** Entering 2, or both zeros. The hole drawn at height 3 shows 2 was never on the axis.

**Kit.** `holes`, `candidate`, `restrict`/`judge`. Nothing new.

**Writer.** Capable cheaper model: two methods, the picture is one line with a hole, the entry rules are one beat.

---

### `rational-equation-check` — One solution, every allowed x, or none

**Standard.** HSA.REI.A.2, "solve simple rational ... equations in one variable, and give examples showing how extraneous solutions may arise."

**Foundations first.** The card, "times zero," and foundation 1 drawn: two sides, two graphs; one crossing is one solution; two graphs lying on each other make every allowed x a solution; two graphs that never meet make none. Then the reading rule for when the letters vanish: 0 = 0 means every allowed x; a false number sentence means none.

**Read.** "Which statement describes all solutions" (gold): the answer is a set. At a glance: the card; any choice equal to the excluded value is gone now.

**Example 1 (one solution).** (x + 10)/(x + 5) = 3. (1) Card: x ≠ −5; "x = −5" dims. (2) Picture: wall at −5, the hyperbola, the flat line y = 3, one crossing left of the wall. (3) Multiply by (x + 5): x + 10 = 3(x + 5) = 3x + 15; −5 = 2x; x = −5/2. (4) Judge: not −5; drop: (15/2)/(5/2) = 3; gold. (5) The statement "x = −5/2."

**Example 2 (every allowed x): fully worked, because the outcome is read, not computed.** (−5x − 15)/(x + 3) = −5. Card: x ≠ −3. Factor the top: −5(x + 3); it is −5 everywhere but at −3, a hole. Picture: the left side is the flat line y = −5 with a hollow dot at (−3, −5); the right side y = −5 is drawn dashed over it, the same line. Clear anyway: −5x − 15 = −5x − 15; 0 = 0, the letters gone and the sentence true. Every real number except −3.

**Quick case (none).** 0/(x − 4) = −2. Zero on top is zero wherever the fraction exists, and 0 is never −2: no solution before any algebra. Picture: the axis with a hole at 4, and a flat line at −2 that never meets it. (Clearing gives 0 = −2x + 8, x = 4, the hole; the same verdict.)

**Fast.** Card; clear; if x remains, solve and judge; if 0 = 0, every allowed x; if a false number sentence, none.

**Sense.** A flat line meets a hyperbola exactly once unless it sits on the curve's asymptote (then never), and the only way for "every x" is that the left side was the flat line in disguise, a factor canceling.

**Check.** Substitute the one solution; for "every x," one safe value in both sides, say 0: −15/3 = −5; for "none," the picture.

**Rule out.** The excluded value as a choice: gone at the card. "Every real number" when the left side has x on top that does not factor out: gone. The one solution versus "no real solutions": prove by the drop.

**Line.** "0 = 0 means every allowed x. A false sentence means none."

**Trap.** Reading 0 = 0 as "no solution" or as "x = 0," and keeping −3 in the "every x" answer. The two coinciding lines with one hole are the memory.

**Kit.** `holes`, `walls`, `candidate`, `restrict`, `dim`. Add: a plot drawn dashed on top of an identical plot so coinciding sides can both be seen (`"over": "L"`, or a dash on the second plot by default when the kit detects coincidence).

**Writer.** Strongest: three outcomes from one procedure, with two verdicts that are readings rather than numbers.

---

### `rational-two-denominators` — Two denominators and a quadratic

**Standard.** HSA.REI.A.2, "solve simple rational ... equations in one variable"; HSA.REI.B.4b, "factoring." Adapt the reference lesson to include walls and the restriction card.

**Foundations first.** The card and "times zero." Then the common denominator in one line from foundation 10: each distinct factor once; here (x − 1)(x − 4) is already the right side's bottom. And the balance (family 11): *every* term is multiplied, including the single fraction on the right.

**Read.** "Which is the solution set" (gold): one number, two, or none. At a glance: two denominators, two excluded values; the card rules out half the choices before any step.

**Example.** 2/(x − 1) + x/(x − 4) = −6/((x − 4)(x − 1)). (1) Card: x ≠ 1, x ≠ 4; "x = 1 only" and "x = −2 and x = 1" dim together. (2) Picture: two rust walls first, then both sides; one crossing at x = −2, left of both walls. (3) Multiply every term by (x − 1)(x − 4), each lit as it goes: 2(x − 4) + x(x − 1) = −6. (4) Expand: 2x − 8 + x² − x = −6; x² + x − 2 = 0; (x + 2)(x − 1) = 0; candidates −2 and 1. (5) Judge: 1 is on the card, struck; drop at 1 lands on the wall. −2: left −2/3 + 1/3 = −1/3; right −6/18 = −1/3; gold. (6) x = −2 only.

**Fast.** Card; multiply every term by each distinct factor once; the fractions clear; factor; judge both roots.

**Sense.** A quadratic gives at most two candidates, and one of them is a wall, so the set has at most one number; the picture shows one crossing.

**Check.** Substitute −2 and say both sides: "negative one third; negative one third."

**Rule out.** Any set containing an excluded value dims at the card. "No solution" versus the one number: the drop proves it.

**Line.** "Before you clear, write what x can't be. Then multiply every term."

**Trap.** Keeping x = 1 because it came from the factoring; and multiplying the right side as if it had no denominator, leaving −6(x − 4)(x − 1). The struck candidate on the card, and the lighting of the right-hand term as its bottom cancels.

**Kit.** `walls`, `candidate`, `restrict`/`judge`, `dim`. Nothing new.

**Writer.** Capable cheaper model: one method, the anchor is the staging model, the card and the drop are kit actions; written after `rational-extraneous-single` fixes the judging beat.
