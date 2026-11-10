# Signed numbers, part 2: concepts for ten problem types

Written from the family design. Each stands on the foundations numbered there and uses the signed `numberline` of section 4.1 unless it says otherwise. Shared across every grade-7 film here: one opening beat that names the picture ("the line; zero is the mirror; the sign says which side, the digits say how far; adding is walking") before the type's own foundations, so the pilot's lessons and these feel like one course.

---

## Signed addition (grade 7)

### `signed-fraction-sum` — Add or subtract two signed fractions. Foundations 6, 7, 9.

**Standard.** 7.NS.A.1c: "Understand subtraction of rational numbers as adding the additive inverse, p – q = p + (–q)." 7.NS.A.1b: "p + q as the number located a distance |q| from p, in the positive or negative direction depending on whether q is positive or negative." 7.NS.A.1d (properties as strategies) in the renaming step.

**Foundations first.** Three things, each a beat. (1) Subtracting is turning around: an arc for +q drawn, then redrawn the other way; p − q = p + (−q). (2) Sign first, then size: the longer walk decides the sign of the sum; the leftover is the size. (3) Named, not retaught: "You already know that pieces must be the same size before you can add them" (family 9). The line for this lesson is cut into the common piece: tick every fifteenth, step 1/15 on an arc, zero tall.

**Read.** "Calculate" with a minus between two fractions: a subtraction, so first turn it into adding the opposite. At a glance: 8/5 is bigger than 4/3 (both are a bit more than one; three fifths is more than one third), so the walk left is longer than the start: the answer is negative, and small (about 1.3 − 1.6).

**The example.** 4/3 − 8/5. (1) Turn back: 4/3 + (−8/5), the arc for 8/5 sketched right then redrawn left in rust. (2) Rename to fifteenths: 3 and 5 both divide 15; 20/15 and 24/15; the line redraws with fifteenths. (3) Drop 20/15 (one and a third). (4) Walk left 24 fifteenths: 20 of them reach zero, 4 more go past it; the bracket shows the two parts. Land at −4/15. (5) Board: 20/15 − 24/15 = (20 − 24)/15 = −4/15; "different signs: 24 beats 20 by 4; the longer walk was left." (6) 4 and 15 share no factor: done.

Quick second case, because the learner will meet it and the motion is different: −1/6 − (−1/2). Subtracting a negative turns the left-pointing arc around: −1/6 + 1/2 = −1/6 + 3/6 = 2/6, which simplifies to 1/3. Four beats on a sixths line. (Same-sign sums, −1/4 + (−5/3), are two rust walks the same way, covered by the integer-addition pilot's method; one line names it.)

**Fast.** Turn subtraction into adding the opposite; decide the sign from the longer size; rename to the common denominator; add or subtract the numerators; simplify.
**Sense.** Start a little over 1, walk left a little over 1.6: land just under zero. −4/15 is about −0.27.
**Check.** Walk back: −4/15 + 8/5 = −4/15 + 24/15 = 20/15 = 4/3.
**Line.** "Sign first, then size."
**Trap.** 4/15 (sign dropped). The walk visibly crosses zero and ends on the rust side; the sign is written on the board before the sizes are subtracted.
**Kit.** `numberline` with a fractional `step` (1/15) and TeX tick labels; `walk` by a fraction; `rename` from a fraction to an equivalent fraction (20/15), not only to a decimal.
**Writer.** A capable cheaper model: one method, two named cases, every number here.

### `signed-changes-sum` — Net change, or the count after the changes, from a table. Foundations 6, 9.

**Standard.** 7.NS.A.1d: "Apply properties of operations as strategies to add and subtract rational numbers" (gathering the gains and the losses is the strategy). 7.NS.A.3 and 7.EE.B.3 ("assess the reasonableness of answers using mental computation and estimation strategies"). 7.NS.A.1b: "Interpret sums of rational numbers by describing real-world contexts."

**Foundations first.** The table: one row per day, a change with its sign (+9 means nine more; −4 means four fewer). Each change is a walk; the order of walks does not change where you end, so gather them: all the gains into one teal walk, all the losses into one rust walk. "Net change" defined: the one gold arc from where you started to where you ended; positive means up, negative means down.

**Read.** Two questions hide under one name. "How many after 6 days" (gold) asks a count: start plus net. "Net change" asks only the gold arc. At a glance: count the gains and losses by color; whichever total is longer gives the net its sign.

**The example.** (The generator's tables are not printed by `facts.ts`; the writer takes the seed's table. The shape here is the "29 books" variant with an illustrative table.) 29 books at the start; changes +9, −4, +12, −7, −2, +7; how many after 6 days? (1) The table fills row by row, each change in its sign's color. (2) Gains: 9 + 12 + 7 = 28. Losses: 4 + 7 + 2 = 13; written −13. (3) The gains are longer: the net is positive; 28 − 13 = 15; net +15. (4) On a line 0 to 60: start 29, teal walk +28 to 57, rust walk −13 back to 44, gold net arc +15 from 29 to 44. (5) 29 + 15 = 44 books.

Quick second case, a net-change question whose net is negative (cars, five days: +6, −9, +3, −8, −1: gains 9, losses 18, net −9: "nine fewer cars than at the start"), so both signs of the net and both question kinds are seen. Four beats.

**Fast.** Add the gains; add the losses; the longer total's sign wins and the difference is the size; add to the start only if a count is asked.
**Sense.** More came in than went out, so the shelf ends above 29, and by less than 28.
**Check.** Walk the table in order on the line: 38, 34, 46, 39, 37, 44. Same landing.
**Line.** "Gains together, losses together; the longer one wins."
**Trap.** Answering 15 when the count is asked (or 44 when the change is asked): the gold word and the one extra step. Adding the losses as if they were gains (28 + 13): the two colors never mix until the fight.
**Kit.** `table` with per-cell `ink` by sign; `walk` labeled with a total; `net`.
**Writer.** Cheaper model, once the seed's table is in hand.

---

## Signed multiplication (grade 7)

### `fl-integer-multiply-divide` — Multiply or divide two integers. Foundation 8. Pilot lesson 4.

**Standard.** 7.NS.A.2a: "multiplication is extended … by requiring that operations continue to satisfy the properties of operations, particularly the distributive property, leading to products such as (–1)(–1) = 1 and the rules for multiplying signed numbers." 7.NS.A.2b: "integers can be divided, provided that the divisor is not zero." 7.NS.A.2c.

**Foundations first.** Built live, with small numbers, before the example. (1) Named: multiplying by a count makes copies (family 7). 3 × (−4) is three walks of −4 laid end to end: −12. (2) The climbing pattern, five short walks stacked in a column: 3 × (−4) = −12, 2 × (−4) = −8, 1 × (−4) = −4, 0 × (−4) = 0; each row ends 4 higher than the last, so the next row must end at +4: (−1) × (−4) = 4, and (−2) × (−4) = 8. One board line says the same thing with the distributive property: (−1)(−4) + (1)(−4) = (−1 + 1)(−4) = 0, so (−1)(−4) must be 4. (3) What a negative count does: multiplying by −1 reflects the line across zero; a negative factor is a flip. Two negative factors flip twice and land where they started. (4) The rule read off the picture: count the negative factors; odd is negative, even is positive; then multiply the sizes. Zero: zero copies of any walk is zero.

**Read.** "Find (−10) × (−8)": both factors negative. At a glance: two negatives, an even count, so the answer is positive; the size is 10 × 8 = 80. The whole answer is known before the picture; the picture is why.

**The example.** (−10) × (−8). (1) First the count: 10 × (−8), ten walks of −8 from zero, landing at −80 on a line from −80 to 80. (2) The count was negative, so flip: every arc and the landing dot reflect across the tall zero tick; land at 80. (3) Board: (−10) × (−8) = −(10 × (−8)) = −(−80) = 80. (4) Two negatives: two flips.

Quick second case, division as the missing factor: (−30) ÷ 5 asks "5 copies of what land at −30?" Five walks of −6. One negative: negative. −6; check 5 × (−6) = −30. Four beats. (−55) ÷ (−5) and 11 × (−10) are the same count; 0 ÷ 11 is zero copies.

**Fast.** Count the negatives, then multiply or divide the sizes.
**Sense.** The sign is settled before any arithmetic; 80 is ten eights.
**Check.** Divide back: 80 ÷ (−8) = −10. Multiply back for a quotient.
**Line.** "A negative factor is a flip; two flips bring you back."
**Trap.** (−10) × (−8) = −80, "two negatives, a bigger negative." The climbing pattern passes through zero and keeps climbing; the second flip lands on the positive side.
**Kit.** `copies` and `flip` (design 4.1); a stacked column of short walks for the pattern (five rows above one line, or `numberline` `rows`).
**Writer.** Strongest: the pattern and the flip are a proof to stage, and the pilot sets the picture.

### `mcas-negative-fraction-forms` — Which expressions equal a stated fraction. Foundations 2, 8. Select 3 of 6.

**Standard.** 7.NS.A.2b: "If p and q are integers, then –(p/q) = (–p)/q = p/(–q)." This is the whole lesson.

**Foundations first.** Named: a fraction is a division, 10/9 = 10 ÷ 9, a bit more than one (family 9). On the line, 10/9 is a dot just right of 1; its mirror −10/9 just left of −1; 9/10 is a different number, inside 0 and 1, with its own dot. Then the clause, drawn: a minus in front, on top, or on the bottom is one flip, and one flip lands on the same mirror dot: three cards, −(10/9), (−10)/9, 10/(−9), each drops onto −10/9. Two minuses flip twice: (−10)/(−9) drops back onto 10/9.

**Read.** "Which 3 are equal to −10/9" (gold): a negative number just past −1. At a glance: any choice upside down (9 over 10) is a different size, gone; of the rest, keep only those with an odd count of minuses.

**The example.** Which 3 expressions are equal to −10/9? (−9)/10 | (−1)·(10/9) | (−10)/9 | 10/(−9) | 10/9 | (−10)/(−9). (1) Size: (−9)/10 is upside down, a number between 0 and −1: dims. (2) Count the minuses on each remaining card: (−1)·(10/9) one; (−10)/9 one; 10/(−9) one; 10/9 none; (−10)/(−9) two. (3) Even counts are positive: 10/9 and (−10)/(−9) drop onto the dot at +10/9 and dim together. (4) The three odd ones drop onto −10/9, the gold dot. Exactly three asked; three found.

**Fast.** Upside down? gone. Count the minuses; match the target's sign.
**Sense.** Every kept card lands on the one gold dot.
**Check.** Say each chosen card aloud as a number: "negative ten ninths." Exactly three chosen.
**Rule out.** Upside-down forms first (size), then the wrong parity (sign): two beats, each dimming together.
**Line.** "In front, on top, or on the bottom: one minus is one flip."
**Trap.** Reading −(10)/(−9) as negative because a minus is in front, or (−10)/(−9) as negative "because there are minuses": the count, not the look. Taking 9/10 for 10/9 because the digits match: it lands on a different dot.
**Kit.** `dim`; cards that drop onto a `numberline` point (the rings' `card` and `drop`, pointed at a line).
**Writer.** Cheaper model: one method, the rule-out written here.

### `signed-fraction-product` — Multiply or divide two signed fractions. Foundations 8, 9.

**Standard.** 7.NS.A.2c: "Apply properties of operations as strategies to multiply and divide rational numbers," with 7.NS.A.2a's sign rule; 6.NS.A.1 "(a/b) ÷ (c/d) = ad/bc" for the reciprocal step, which is family 9's and is named, not retaught.

**Foundations first.** Two lines. "Count the negatives: odd is negative, even is positive" (from `fl-integer-multiply-divide`, one beat with the flip). "You already know: to divide by a fraction, multiply by its reciprocal; to multiply fractions, multiply across and cancel what you can" (family 9). The sign is written on the board before any size work, and the picture is the one flip at the end: the positive answer's dot reflects across zero.

**Read.** "Calculate −3/2 ÷ 13/8": a division with one negative. At a glance: one negative, so the answer is negative; 3/2 divided by something a little bigger (13/8 is 1 and 5/8) is a little less than 1.

**The example.** −3/2 ÷ 13/8. (1) Sign first: one negative; write "−" and a blank. (2) Size: 3/2 ÷ 13/8 = 3/2 × 8/13. (3) Cancel: 8 and 2 share 2: 3/1 × 4/13. (4) Multiply across: 12/13. (5) Fill the blank: −12/13. (6) The dot for 12/13, just inside 1, flips across zero to −12/13.

Quick second case, two negatives in a product: −1/2 × (−7/4). Even count: positive; 7/8. Three beats; the dot flips twice and stays.

**Fast.** Count the negatives; flip the divisor if dividing; cancel; multiply across; put the sign on.
**Sense.** A little less than one, on the negative side.
**Check.** Multiply back: −12/13 × 13/8 = −12/8 = −3/2.
**Line.** "Count the negatives, then it is fifth-grade fractions."
**Trap.** Doing all the size work and forgetting the sign (12/13). The sign is written first and the answer's blank waits for the size. (Flipping the wrong fraction is family 9's trap; the reciprocal is named as the divisor's.)
**Kit.** None beyond `flip` of a single point.
**Writer.** Cheaper model.

---

## Rational stories (grade 7)

### `signed-story` — Multi-step stories with signed decimals. Foundations 1, 6, 7, 9. Mixed type: teaches reading.

**Standard.** 7.NS.A.3: "Solve real-world and mathematical problems involving the four operations with rational numbers." 7.EE.B.3 (multi-step, "assess the reasonableness"). 7.NS.A.1b: "Interpret sums of rational numbers by describing real-world contexts." 7.NS.A.1c: "the distance between two rational numbers on the number line is the absolute value of their difference, and apply this principle in real-world contexts" (the hiker and the diver).

**Foundations first.** Every story picks what zero means and which way is positive, and the lesson says it aloud each time (the unpracticed clause of 6.NS.C.5): an empty account, freezing, sea level; up or in is positive. The line stands vertical: up is positive. Each change is a walk: "deposits", "rose", "rises" go up in teal; "pays", "fell", "descends" go down in rust; "each hour for 2 hours" is the same walk twice (copies). The decimal arithmetic is family 2's stack with the point lined up, beside the line, never re-taught: the walk decides the sign, the stack gives the size.

**Read.** Two kinds of story. *A start and some changes*: "what is the balance now" asks a position; walk each change from the start. *Two positions*: "by how many degrees did it rise", "how many meters apart" ask the walk from one to the other, end − start, and across zero it has two parts that add. At a glance: in the account story more goes out (two bills, 37.50) than comes in (30.30), and it starts in debt, so it ends deeper in debt.

**Example 1 (a start and changes).** A balance of −17.80 dollars; a deposit of 30.30; then 2 bills of 18.75 each. What is the balance now? (1) Zero is an empty account; below zero is owing the bank. Dot at −17.80 on a vertical line from −30 to 20. (2) Deposit: walk up 30.30. The bracket shows two parts: 17.80 brings it to zero, 12.50 more. Stack 30.30 − 17.80 = 12.50. Land at 12.50. (3) Two bills: 2 × 18.75 = 37.50, two rust walks down (the trap, "fell 2.5 each hour for 2 hours," is this motion). (4) 12.50 down to zero, then 25.00 more: stack 37.50 − 12.50 = 25.00; land at −25.00. (5) Board, each line a walk: −17.80 + 30.30 = 12.50; 12.50 − 37.50 = −25.00. Answer −25 dollars: twenty-five dollars owed.

**Example 2 (two positions), a different act.** At 5 a.m. −6.5°C; at 2 p.m. 9.25°C. By how many degrees did it rise? Zero is freezing. Two dots on a thermometer line. "Rise" is the walk from the first to the second: 9.25 − (−6.5). The bracket crosses zero: 6.5 up to zero, 9.25 more; 6.5 + 9.25 = 15.75 (stack). Quick third screen: a hiker 19.5 m above sea level, a diver 3 m below, "how many meters apart": the same bracket, 19.5 + 3 = 22.5. Three beats.

**Fast.** Say what zero means; write the start with its sign; write each change with its sign, a repeated change multiplied; for two positions, subtract start from end and add across zero.
**Sense.** In debt, then more out than in: deeper in debt; roughly −18 + 30 − 38 = −26.
**Check.** Net change: +30.30 − 37.50 = −7.20; −17.80 + (−7.20) = −25.00. For the rise, walk back: 9.25 − 15.75 = −6.5.
**Line.** "Say what zero means and which way is up; then every change is a walk."
**Trap.** Paying one bill instead of two: the two rust walks. 9.25 − 6.5 = 2.75 for the rise (subtracting the sizes across zero): the bracket's two parts add. 12.50 − 37.50 = 25 (sign dropped): the dot ends below zero.
**Kit.** `numberline` `vertical: true` with decimal values; `walk` by decimals; `copies` for the repeated change; `measure` between two points that shows its two parts; the board's `stack` beside the figure.
**Writer.** Strongest: mixed reading with no shared recipe.

### `signed-jumps` — Where a list of changes ends on a number line. Foundation 6.

**Standard.** 7.NS.A.1: "represent addition and subtraction on a horizontal or vertical number line diagram." 7.NS.A.1b: "p + q as the number located a distance |q| from p, in the positive or negative direction depending on whether q is positive or negative."

**Foundations first.** The picture is given by the problem (the app's own number-line scene with its arrows), so the lesson teaches how it was drawn: an arrow's length is the size of the change, its direction the sign, right in teal, left in rust; each arrow starts where the last one ended; half-unit changes land halfway between ticks. The step on an arc, so jumps are counted and not ticks.

**Read.** "At what number does the last arrow end": a position, the last landing. At a glance: the rights (6.5 and 2) beat the lefts (4.5) by 4, so the end is 4 to the right of the start.

**The example.** Start −7; changes +6.5, −4.5, +2. (1) Dot at −7, labeled start. (2) +6.5: six units right reach −1, half more lands at −0.5, half a tick short of zero. (3) −4.5: from −0.5, four and a half units left: −5. (4) +2: −3. (5) Board, one line per arrow: −7 + 6.5 = −0.5; −0.5 + (−4.5) = −5; −5 + 2 = −3. (6) Gold net arc from −7 to −3, labeled +4: the changes add to +4 whatever the order.

**Fast.** Walk each arrow in turn; or add the changes for the net and add it to the start. Both always work.
**Sense.** Right beats left by 4, so the landing is right of −7, and not past zero.
**Check.** −7 + 4 = −3, the net arc.
**Line.** "Each arrow starts where the last one ended; length is the size, direction is the sign."
**Trap.** −7 + 6.5 read as 0.5 or 13.5: a walk toward zero shrinks the distance, 7 − 6.5 = 0.5, and the arrow visibly stops short of the tall zero tick.
**Kit.** Highlight and label the scene's arrows one at a time; a gold `net` arc over the scene's line.
**Writer.** Cheaper model.

### `check-register-blanks` — Complete a check register. Foundations 6, 7, 9.

**First.** `facts.ts` prints one wording and four blank ids (two balances, two amounts) but not the register's numbers. Confirm that the generator lets the balance go below zero (an overdraft). If it never does, nothing in the type is signed: it is 6.NS.B.3 decimal arithmetic in a table and belongs with its grade-6 sibling under family 21, as the family design flagged. The concept below assumes an overdraft; if the generator lacks one, add it.

**Standard.** 7.NS.A.3; 7.NS.A.1c: the missing amount is "the absolute value of their difference" with its sign from the direction; 7.EE.B.3 (reasonableness).

**Foundations first.** The words: an account holds money; its balance is how much is in it; a deposit is money in (+), a withdrawal money out (−); a check register lists each line and the balance after it. How it is built, said as the one rule: each balance is the balance above it plus this line's amount. A balance below zero means the account owes the bank. Picture: the `table` (Entry | Amount | Balance) beside a vertical line whose dot walks as each row fills; the amount column colored by sign.

**Read.** "Complete it": two kinds of blank. A missing balance: walk forward, before + amount. A missing amount: the walk between two balances, after − before; it went down, so a withdrawal; up, so a deposit. At a glance: the direction of each gap gives its sign before any arithmetic.

**The example** (illustrative numbers; the writer uses the seed's). Start 40.00. Row 1: paycheck +85.50, balance ?. Row 2: rent, amount ?, balance 32.75. Row 3: groceries −48.20, balance ?. Row 4: deposit, amount ?, balance 24.55. (1) Row 1: 40.00 + 85.50 = 125.50 (stack); dot walks up. (2) Row 2: the balance fell, 125.50 to 32.75: a withdrawal; bracket between the two balances; stack 125.50 − 32.75 = 92.75; write −92.75. (3) Row 3: 32.75 down 48.20: past zero; 32.75 to zero, then 15.45 more (stack 48.20 − 32.75 = 15.45); balance −15.45; the dot sits below zero: the account owes 15.45. (4) Row 4: from −15.45 up to 24.55: a deposit; the bracket crosses zero in two parts, 15.45 + 24.55 = 40.00; write +40.00.

**Fast.** Missing balance: before + amount. Missing amount: after − before, sign from the direction, size from the gap (two parts across zero).
**Sense.** Balance down means a negative amount; a deposit that lifts a debt to a positive balance is bigger than either.
**Check.** Every row: before + amount = after. −15.45 + 40.00 = 24.55; 125.50 + (−92.75) = 32.75.
**Line.** "Each balance is the last one plus this line; a missing amount is the walk between two balances."
**Trap.** Writing 92.75 for a withdrawal (sign dropped): the rust arrow points down. 24.55 − 15.45 = 9.10 for the deposit (subtracting sizes across zero): the bracket's two parts.
**Kit.** `table` with `running` column, `"?"` cells and `solve`, linked to a vertical `numberline` (design 4.4); per-cell `ink`; the stack beside.
**Writer.** Strongest for the first one (two methods chosen by reading, four blanks, a crossing of zero); a cheaper model after the first sets the shape.

---

## Irrational numbers (grade 8)

### `mcas-rational-irrational-select` — Which expressions have a rational value. Foundations 11, 12, 14.

**First.** √13 · √325 needs the product of roots (HSN.RN.A.2) and 5π needs "a nonzero rational times an irrational is irrational" (HSN.RN.B.3): both reach past 8.NS.A.1. Keep the type; the lesson teaches each in one plain beat.

**Standard.** 8.NS.A.1: "Know that numbers that are not rational are called irrational." HSN.RN.A.2 for the product; HSN.RN.B.3 for the π rule.

**Foundations first.** Rational: can be written as a fraction of two integers; every whole number, every ending or repeating decimal. Irrational: cannot; π, and √13 because 13 is between the squares 9 and 16 (the square ruler, one beat). Then the four facts this type turns on, each a beat on the board. Squaring undoes a square root: (√13)² = 13, that is what the symbol means. (√13)⁴ = 13 · 13 = 169, but (√13)³ = 13 · √13 keeps a root. Roots multiply under one root: √13 · √325 = √(13 · 325), because squaring the product gives 13 · 325. π times or divided by a nonzero fraction stays irrational: if 5π were a fraction, dividing by 5 would make π one. Picture: the rings with two regions, rational inside and the irrational band outside; each expression is a card that simplifies, then drops where it belongs.

**Read.** "Which 2 have a rational value" (gold): exactly two. At a glance: a lone π that nothing cancels makes a card irrational: 5π, π², (√13)² · π = 13π are gone in one beat. Two cards remain; prove both.

**The example.** 5π | π² | (√13)⁴ | √13 · √325 | (√13)² · π. (1) Three π cards dim together: "a fraction times π is not a fraction." (2) (√13)⁴ = (√13)² · (√13)² = 13 · 13 = 169: the card rewrites and drops inside. (3) √13 · √325 = √(13 · 325) = √4225; is 4225 a square? 65² = 4225 (60² = 3600, plus 2 · 60 · 5 = 600, plus 25): so 65: drops inside. (4) Two chosen, as asked.

Quick second case, odd powers and a cube root: (∛6)² | 2√13 | (√13)² | (√10)²/2 | (√13)³. 2√13 keeps a root; (√13)³ = 13√13 keeps a root; (∛6)² = ∛36 and 36 is not a cube; (√13)² = 13 and (√10)²/2 = 5 are rational. Five beats, each card rewriting once.

**Fast.** Rewrite each card; a leftover root or π means irrational; a whole number or fraction means rational.
**Sense.** 169 and 65 are counting numbers.
**Check.** Square back: 65² = 4225 = 13 · 325; 13² = 169. Exactly two chosen.
**Rule out.** Lone π; an odd power of a non-square root; a root of a non-square or non-cube: each dims with its one reason.
**Line.** "A root symbol is not a verdict: rewrite, then decide."
**Trap.** (√13)⁴ marked irrational "because it has a root"; √13 · √325 marked irrational because each factor is. Both cards are rewritten to whole numbers on the board before any verdict.
**Kit.** `rings` with `sets: ["rational"]` and the real band, `card`, `simplify`, `drop`; `dim`; the square ruler for the one √13 beat.
**Writer.** Strongest: the product property and the π argument must be said exactly right for grade 8.

### `classify-real-number` — Pick the one rational (or irrational) number. Foundations 11, 12.

**Standard.** 8.NS.A.1: "Know that numbers that are not rational are called irrational … for rational numbers show that the decimal expansion repeats eventually." 8.EE.A.2: "Evaluate square roots of small perfect squares and cube roots of small perfect cubes."

**Foundations first.** Rational: a fraction of two integers; its decimal ends (−0.03 = −3/100) or repeats (11/9 = 1.222…), one beat each. Irrational: no fraction reaches it; its decimal never ends and never repeats. The square ruler: squares above the ticks; a root is a whole number only when its radicand sits exactly on a square (√4 lands on 2); between two squares it is irrational (√90 falls between 81 and 100, strictly between 9 and 10, on no tick). The cube ruler, the same with 1, 8, 27, 64, 125 above. A patterned decimal is not a repeating one: 0.1010010001… writes its blocks, 1, 10, 100, 1000, each longer than the last; no block ever comes back.

**Read.** "Which number is rational" (gold): exactly one. At a glance: for each root, name the two squares or cubes around it; only an exact landing is rational.

**The example.** √71 | ∛16 | ∛64 | 0.1010010001… (1) √71: 64 < 71 < 81, between 8 and 9: the dot falls between ticks. (2) ∛16: 8 < 16 < 27, between 2 and 3. (3) 0.1010010001…: the blocks written with brackets of growing length; nothing repeats. Those three dim together: "none lands exactly." (4) ∛64: 4 × 4 × 4 = 64, so ∛64 = 4, exactly on the tick: rational.

Quick second case, the other direction: which is irrational? −0.03 | 11/9 | √4 | √90. −0.03 ends; 11/9 is already a fraction; √4 lands on 2; √90 falls between 81 and 100. Four beats.

**Fast.** For a root, bracket the radicand with squares (or cubes): exact is rational, between is irrational. Fractions, ending decimals and repeating decimals are rational.
**Sense.** ∛64 = 4 because 4 · 4 · 4 = 64.
**Check.** Cube the answer back; exactly one chosen.
**Rule out.** Roots that fall between their squares or cubes; a decimal whose blocks grow.
**Line.** "A root is rational only when it lands exactly on a square."
**Trap.** √4 marked irrational "because it has a root"; 0.1010010001… marked rational "because it has a pattern." The ruler lands √4 on 2; the blocks are written out and never repeat.
**Kit.** Square ruler `upper: "square"` and `"cube"`, `locate` (design 4.2); the decimal's blocks as a board line with brackets.
**Writer.** Cheaper model: one method, every case named here.
