# Expressions and polynomials, part 2: concepts for ten problem types

Written from the family design. Each stands on the foundations ladder by number and uses the family's pictures: the board with its box and collapse, the product grid, the tile chart, the two tables, the named squares. Two things the facts output hides and the writer must read from the template before writing: the prompt of each slot in `show-work-box-cost` (the first slot's count of boxes is not in the facts), and the row expressions of `equivalent-expressions-table`.

---

## Variable expressions (grade 6)

### `show-work-box-cost` — A story to an equation, solved by undoing

**Misfiled first.** This is 7.EE.B.4a ("solve word problems leading to equations of the form px + q = r"), family 11 at grade 7. Its one expression moment (4c is the cost of c boxes) is the only place the app writes a variable expression from words, so the lesson keeps that moment and teaches the whole story; but it should be filed under equations.

**Standard.** 7.EE.B.4a as quoted; 6.EE.B.6 "use variables to represent numbers and write expressions when solving a real-world problem"; 6.EE.A.2a "write expressions that record operations... with letters standing for numbers."

**Foundations first.** Same price for every box: the total is the price times the count (family 7's equal groups, one line). A coupon is money taken off once, off the whole purchase, not off each box. A letter for the count we do not know: c boxes cost 4c dollars, "four times c", because every box is 4. Build the bar: c boxes drawn as equal 4-dollar parts in a row with a dotted gap and a bracket "c boxes: 4c"; the coupon is a rust strip cut off the end; what is left is what was spent.

**Read.** Five slots, in the order the story happens: the cost of a stated number of boxes with no coupon; the cost of c boxes, 4c; with the coupon, 4c − 2.50; the equation undone one step, 4c = 36; the count, c = 9. The gold word is "exactly 33.50 ... uses the coupon": the 33.50 is *after* the coupon. At a glance: 33.50 is about eight and a half boxes' worth, so the answer is a little more than 8, and it is a whole number of boxes.

**The example.** The craft store: 4 dollars a box, coupon 2.50, spends 33.50. (1) Slot one is a plain count: the slot names how many boxes (say 3): 3 boxes at 4 dollars, 12. (2) We do not know the club's count: call it c. c boxes cost 4 times c: 4c; the bar of c equal parts, bracket 4c. (3) The coupon comes off once: the rust 2.50 strip cut from the end: 4c − 2.50. (4) What is left is what was spent: 4c − 2.50 = 33.50. Undo in reverse order (family 11's line, said once): the last thing that happened to the money was the coupon coming off, so put it back first: the strip slides back on; 33.50 + 2.50 stacked on the point: 36.00. 4c = 36. (5) 36 dollars of 4-dollar boxes: 36 ÷ 4 = 9; the bar cuts into nine 4s. c = 9.

**Fast.** Add the coupon back to what was spent, then divide by the price.
**Sense.** A whole number of boxes; a little more than 33.50 ÷ 4 (about 8).
**Check.** Work forward: 9 boxes, 4 × 9 = 36; coupon off, 36 − 2.50 = 33.50. Said aloud as the story.
**Line.** "The coupon comes off once, off the whole bar. Put it back first."
**Trap.** Two real ones: taking the coupon off each box (a 1.50 box) because "4 dollars each" and "2.50 off" sit side by side; and dividing 33.50 by 4 first, then adding 2.50. The bar shows one rust strip on the whole, and the undo starts with that strip. Also 4c read as "4 and c": the bar's bracket reads "c boxes: 4 each".
**Kit.** A bar of an unknown count of equal parts (c parts with a dotted gap and a bracket) and a rust strip cut from its end and slid back on; `stack` with the point for 33.50 + 2.50. Nothing else.
**Writer.** Strongest: a story, five slots whose prompts are not in the facts, and the undo must be told as the story in reverse, not as a recipe.

### `variable-in-situation` — Which quantity can change?

**Standard.** 6.EE.B.6: "understand that a variable can represent an unknown number, or, depending on the purpose at hand, any number in a specified set." The constant half is the standard's contrast, not its text.

**Foundations first.** Define both words with one picture: run the story forward as a table (the kit's `table`), one row per week. Week: 1, 2, 3, 4. Dollars saved that week: 8, 8, 8, 8. Total so far: 8, 16, 24, 32. Days in a week: 7, 7, 7, 7. Rows fill one at a time. A column that is the same number in every row is a **constant**: the story fixes it, or the world does. A column that changes from row to row is a **variable**: you cannot write its number until you know which week. Say the test plainly: "Could you write this number down right now? Then it is fixed. Do you need to know which week first? Then it can change."

**Read.** The gold word is "change ... variable" or "stays the same ... constant"; the question is the same table read the other way. At a glance: a choice that carries a number after its colon ("in a week: 7", "each week: 8") is a number you could write right now, so it is a constant; a choice with no number is a quantity that depends on the case. That is not a trick, it is the definition showing through the choices.

**The example.** "Student A saves 8 dollars every week and keeps a count of the weeks. Which quantity can change, so it is a variable?" Choices: days in a week: 7 | dollars Student A saves each week: 8 | cents in a dollar: 100 | total dollars saved so far. The table fills; each choice is a column. 7, 8, 100: three columns that never move, dimmed together: "you could write those now." The total column climbs 8, 16, 24: the variable.
A quick second case for the other direction and a different story: "A teacher shares 8 markers equally among the groups in a class. Which stays the same, a constant?" The groups could be 2 or 4; markers per group and leftovers change with it; the markers, 8, and the days in a week, 7, do not. Days in a week: 7.

**Fast.** Ask "could I write its number right now?"
**Sense.** The variable is the thing the story is keeping count of or sharing out; the constants are the fixed amounts and the facts about the world.
**Check.** Point at the chosen column in the table: it changes (or does not).
**Line.** "Fixed now: a constant. Depends on the case: a variable."
**Trap.** Choosing "the dollars Student A saves each week: 8" as the variable because it is the quantity the story is about and "every week" sounds like movement. The 8 column of the table never changes.
**Kit.** `table` only.
**Writer.** A capable cheaper model can write it from this concept: the table does the teaching and the choices read off its columns. (The family design listed it as strongest; the table picture makes it one method.)

---

## Expression properties (grade 6)

### `equivalent-expressions-check` — Equivalent, or not, and how you know

**Off grade.** 5(x − 7) − 4(x − 5) and 2/5(25x − 25) are 7.EE.A.1 (rational coefficients, subtraction of a group). Design them in; flag for the alignment list.

**Standard.** 6.EE.A.4: "two expressions are equivalent ... when the two expressions name the same number regardless of which value is substituted"; 6.EE.A.3: "apply the distributive property ... to generate equivalent expressions"; 7.EE.A.1 for the signed and fraction variants.

**Foundations first.** Define equivalent with the Student B variant as the opening demonstration: 5(x + 2) and x + 10. Drop in x = 0: both 10. Drop in x = 1: 15 and 11. One mismatch proves they are different; a match proves nothing, because "every value" is a promise about all of them. Then the reason an equivalence *is* true: the rectangle. 5(x + 2) is 5 tall, x + 2 wide; cut on the plus: 5x and 10. Every part gets multiplied, which is exactly what x + 10 forgot. (This covers the Student B question kind completely; it is never a separate example.) A quarter of a sum is a quarter of each part: the rectangle 20x | 12 cut into four equal rows, one row gold: 5x and 3.

**Read.** The gold word is "NOT" or "equivalent". For NOT: three choices agree with the given and one does not. At a glance: simplify the given to its plain form, "so many x plus a number"; then x = 0 against each choice compares the constants, and x = 1 finishes anything that survives.

**The example.** "Which is NOT equivalent to 1/4(20x + 12)?" Choices: 5x + 12 | 3 + 5x | 1/4·20x + 1/4·12 | 5x + 12/4. (1) The rectangle 20x | 12, cut into four equal rows; one row: 5x and 3. The plain form: 5x + 3. (2) Each choice against it: 1/4·20x + 1/4·12 is the cut written before computing: equivalent. 5x + 12/4: 12/4 is 3: equivalent. 3 + 5x: the same two parts, the other order: equivalent. 5x + 12: the 12 was never quartered. (3) The proof it is not: x = 0: the given is 3; 5x + 12 is 12. Dim the three together, box 5x + 12.
Second example, a different case (a group subtracted, and the x-terms combine): "Which is equivalent to 5(x − 7) − 4(x − 5)?" Choices: x + 13 | 9x − 55 | x − 55 | x − 15. Two rectangles, the second taken away. 5(x − 7): 5x with a 35 strip gone: 5x − 35. Taking away 4(x − 5) is the opposite of 4x − 20: −4x + 20, every sign flipped (family 3, one line). Collect: 5x − 4x is x; −35 + 20 is −15. x − 15. Rule out by x = 0: the given is 5(−7) − 4(−5) = −35 + 20 = −15; x + 13 gives 13, 9x − 55 and x − 55 give −55: all three die in one beat; x − 15 gives −15.
The factoring variant (18x − 24) is `factor-out-choice`'s method: multiply each choice back; 6(3x − 4) = 18x − 24. Say it in one beat as the same question asked backward.

**Fast.** Simplify the given to ax + b. Test x = 0 on every choice (that compares the constants); x = 1 if two survive.
**Sense.** Equivalent choices are the same two pieces in another costume (a fraction unreduced, the order swapped, the cut not yet computed); the odd one has a piece missing or a sign wrong.
**Check.** The survivor against the given at x = 1: 1/4(32) = 8; 5 + 3 = 8.
**Line.** "Same number for every x: equivalent. One mismatch proves not; the rectangle proves yes."
**Trap.** Distributing to one part only (5x + 12 is the decoy, and it is also the Student B story); flipping only the first sign of the subtracted group (x − 55); believing a match at x = 0 is proof. The quartered rectangle, the whole rust row flipping at once, and the two-value opening make each impossible.
**Kit.** `area` gains `share`: cut a rectangle into n equal rows on the word, light one, and write each part's share in it. The x-length is overridable (`"x": 1.4`) so a 20x part fits the card and is still an unticked length. `dim`.
**Writer.** Strongest: six variants, three question shapes, and every decoy is a different property that the lesson must name in a sixth grader's words.

### `distributive-expression-choice` — Five times a sum is five of every part (pilot 2)

**Off grade.** −6(x − 3) is 7.EE.A.1; keep, flag.

**Standard.** 6.EE.A.3: "apply the distributive property to the expression 3(2 + x) to produce the equivalent expression 6 + 3x." 6.EE.A.4 for "for every real x". 7.EE.A.1 for the signed variant.

**Foundations first.** "Equals for every real x" means: whatever number x is, both give the same number. The rectangle: 5(x + 4) is a rectangle 5 tall and x + 4 wide. Drawn to scale: 5 unit rows with ticks; x as an unticked length (visibly a length, visibly not a count); 4 ticked units beside it. Its area is five of every part. Cut on the plus: a 5 by x part, 5x, and a 5 by 4 part, 20. Say "every part gets multiplied" once, on the cut.

**Read.** The gold is "for every real x". At a glance: 5 times a sum; the answer has two terms and both are five of something, so a term that 5 does not go into (the 4 in 5x + 4) cannot be there.

**The example.** "Which expression equals 5(x + 4) for every real x?" Choices: 5x − 20 | 5x + 4 | 5x + 20. (1) The rectangle, to scale, headers 5 at the left, x and 4 on top. (2) Cut on the plus; cells fill: 5x, 20. (3) 5x + 20. Rule out, in one beat: 5x + 4 left the 4-wide part uncut: point at the twenty unit squares it forgot. 5x − 20: a minus from nowhere; the inside is a plus. Both dim. Proof by one number: x = 0: 5(4) = 20; 5x + 20 gives 20.
Second example, a genuinely different case (a subtraction inside, a negative outside): "−6(x − 3)". Choices: −6x − 18 | −6x + 18 | −6x − 3. First 6(x − 3): the rectangle 6 tall and x wide with a 3-wide strip taken away in rust: 6x − 18. Then −6 is the opposite of 6, so the whole thing is the opposite of 6x − 18: every sign flips: −6x + 18 (the sign rule from signed numbers, one line). Rule out: −6x − 3 forgot the 6 on the 3; −6x − 18 flipped only the first sign. x = 0: −6(−3) = 18; −6x − 18 gives −18. x = 3 as the check: −6(0) = 0; −18 + 18 = 0.

**Fast.** Multiply the outside by every part; keep each sign; a negative outside flips every sign of the result.
**Sense.** The rectangle's two parts are both multiples of the outside number; a negative outside makes the constant's sign the opposite of the inside's.
**Check.** x = 0 and x = 1 on both forms.
**Line.** "Every part gets multiplied."
**Trap.** 5x + 4, the decoy the family exists to kill: the uncut part of the rectangle is pointed at. −6x − 18: the first sign flipped and the second forgotten; the whole result flips in one beat, rust.
**Kit.** `area` with terms, `cut`, `strip`; the x-length overridable (x = 3.4 leaves a 0.4 sliver for x − 3; draw x as 6.4 in the second figure, still unticked). `dim`.
**Writer.** A capable cheaper model, once the kit exists: two fixed examples, one motion each, decoys named here. The pilot's first pass is by the strongest writer regardless.

### `factor-out-choice` — The same rectangle seen backward

**Standard.** 6.EE.A.3: "apply the distributive property to the expression 24x + 18y to produce the equivalent expression 6(4x + 3y)." The goal's "positive or negative" factor never occurs in a variant.

**Foundations first.** Factoring is distributing read backward: the parts of the rectangle, given; the whole rectangle and its height, wanted. Draw 12x + 4y + 12 as three rectangles that each have height 2: 2 by 6x, 2 by 2y, 2 by 6, to scale. They slide together into one rectangle 2 tall; the common height goes outside as the factor; the widths stay inside: 2(6x + 2y + 6). Say once: "the 2 is in every part, so it comes out of every part."

**Read.** "Factor 2 out of": the answer is 2 times a group, and inside the group every term is the original term divided by 2 with its own sign. At a glance: three terms inside, all plus, each smaller than before.

**The example.** "Factor 2 out of 12x + 4y + 12. Which expression is equivalent?" Choices: 2(6x + 4y + 6) | 2(6x + 2y + 6) | 2(6x + 2y − 6) | 2(6x + 2y + 12). (1) The three height-2 rectangles, widths 6x, 2y, 6, each divided on the word: 12x is 2 sixes of x; 4y is 2 twos of y; 12 is 2 sixes. (2) Join: one rectangle 2 tall, 6x + 2y + 6 wide. (3) 2(6x + 2y + 6). Rule out by multiplying back one term each: 2 · 4y = 8y, not 4y; 2 · 12 = 24, not 12; 2 · (−6) = −12 but the original has +12. All three dim together.
Quick second case, the signs: "Factor 3 out of 15x − 9y + 18": 5x, −3y, 6; the minus rides with its term: 3(5x − 3y + 6). Decoy 3(5x − 3y + 7): 3 × 7 = 21.

**Fast.** Divide every term by the number, keep every sign, write the number outside.
**Sense.** Same number of terms, same signs, each inside term smaller.
**Check.** Multiply back every term: 2 · 6x, 2 · 2y, 2 · 6.
**Line.** "If it comes out of one part, it comes out of every part."
**Trap.** Factoring some terms and not others: 2(6x + 4y + 6). In the picture the 4y rectangle cannot join a row of height 2 unless it is also 2 tall, and then it is 2y wide. Also keeping the constant whole (+12 inside) when the x-terms were halved.
**Kit.** `area` with `join` (parts slide together; common header moves outside). `dim`.
**Writer.** A capable cheaper model: one motion, decoys fixed by multiplying back.

### `equivalent-expressions-table` — Mark each row

**Standard.** 6.EE.A.4 as quoted; the rows test 6.EE.A.3's "properties of operations": times 1 does nothing, a product regroups, a sum regroups and reorders. The row expressions are not in the facts output; the writer must take them from the template, and the examples below assume rows of that kind.

**Foundations first.** Equivalent means the same number for every value (one line; the Student B two-value idea from `equivalent-expressions-check` is said, not rebuilt). The sure way to know two expressions agree for every value is to make each as plain as it can be and see if they land on the same thing. The tiles make "plain" visible: 1 · (3n) is three n-tiles taken once: three n-tiles. (2 · x) · 3 is two x-tiles, three times: six x-tiles. (w + 4) + 5 is a w-tile with four squares and five more: w and nine squares. A row is equivalent when its tiles are the same tiles.

**Read.** "Mark each as equivalent or not": every row is its own yes or no; there is no count of yeses to aim for. At a glance: a row with a different letter, or a letter that appears a different number of times, or squares where the given has none, is out.

**The example.** Given: (2 · x) · 3. Tiles: two x-tiles, then that twice more: six x-tiles; plain form 6x. Rows worked in turn, each by its tiles: 6x, same six tiles: yes. 2 · (x · 3): x three times is three tiles, then two of those: six tiles: yes (regrouping a product). 5x: five tiles: no; prove it with one number, x = 1: 6 against 5. 2x + 3: two tiles and three squares, not six tiles: no; x = 1: 6 against 5 again, so also x = 2: 12 against 7. Each no gets its rust row in the kit's table of values beside the tiles.
A quick second case for the sum kind: (w + 4) + 5 is w + 9; (w + 5) + 4 and 9 + w are the same tiles; w + 20 and 4w + 5 are not (4w + 5 at w = 1: 9 against 10).

**Fast.** Count the tiles of each row; same tiles, yes. For a no, one number that disagrees.
**Sense.** Times 1 and plus 0 change nothing; regrouping a product or a sum changes nothing; changing how many of the letter there are, or adding squares, changes the number.
**Check.** Two values (1 and 2) on every row marked yes; one value on every row marked no.
**Line.** "Make it as plain as it gets; same tiles, equivalent."
**Trap.** Reading 1 · (3n) as 3n + 1 or 4n (the 1 added or counted); taking (2 · x) · 3 as 2x + 3; marking w + 20 equivalent because 4 · 5 = 20. The tiles never add a square for a times 1, and the sum's squares count to 9.
**Kit.** `tiles` mode of `blocks`; `table` with a rust row highlight.
**Writer.** Strongest: the rows are unknown to the facts, each is a different property, and the yes/no must be argued in a few beats each.

---

## Linear expressions (grade 7)

### `combine-like-coefficient` — Count the x's (pilot 3)

**Standard.** 7.EE.A.1: "apply properties of operations as strategies to add ... linear expressions" (integer coefficients here); 6.EE.A.2b "identify parts of an expression ... coefficient."

**Foundations first.** Define with the tile chart. A **term** is a part that is added: in −x + 5x + 2 the terms are −x, 5x and 2. An **x-tile** is a long tile; a square is a 1. 5x is five x-tiles: the **coefficient** is the count, 5. −x is one rust x-tile, coefficient −1, the 1 not written. 2 is two squares and has no x in it: the **constant**. **Like terms** are tiles of the same shape. Say once: "This is the place-value chart with x instead of ten. One difference: no carrying. Ten x's never make anything else." Chart columns x | 1, count above each pile, signed count under it.

**Read.** "Combine like terms, then the coefficient of x": the answer is a number, not an expression, and it is the count of x's after pairing off, with its sign. At a glance: the constant cannot change the answer; the answer is the x-coefficients added with their signs.

**The example.** "Combine like terms in −x + 5x + 2. What is the coefficient of x?" (1) Tiles fly from the line into the chart: one rust x-tile (it is −1x), five teal x-tiles, two squares in the 1 column. (2) A rust x and a teal x pair off and fade; the count ticks 5 to 4. (3) Under the x pile: 4. The squares stay where they are: 4x + 2. (4) The coefficient of x is 4. Line: 4x + 2 on the board with the 4 gold.
Two quick cases, each a different look. 4x − 4x − 6: four teal and four rust x-tiles pair off completely; the x pile is empty; the count reads 0: coefficient 0 (the expression is −6, and 0 is the answer the question asks for). −7x + 5x + 8: five pairs fade; two rust x-tiles remain: −2.

**Fast.** Add the x-coefficients with their signs; an unwritten coefficient is 1; leave the constant alone.
**Sense.** More teal than rust: positive; more rust: negative; equal: 0.
**Check.** x = 10 in the original and the result: −10 + 50 + 2 = 42; 4(10) + 2 = 42.
**Line.** "Like pieces count together. The coefficient is the count."
**Trap.** Adding the constant in (4x + 2 as 6x, or coefficient 6): squares are a different shape and sit in another column. Reading −x as 0 or as "minus nothing": one rust tile is drawn and takes one teal with it.
**Kit.** `tiles` with `sort` and `cancel`.
**Writer.** A capable cheaper model from this concept; the pilot's first pass by the strongest.

---

## Expression structure (Algebra 1)

### `binomial-area-product` — Four cells, not two

**Misfiled.** HSA.APR.A.1 ("add, subtract, and multiply polynomials"), not HSA.SSE; it duplicates the binomial case of `polynomial-multiplication` and should merge with it. Designed here because the garden and tile wordings are its own.

**Standard.** HSA.APR.A.1 as quoted.

**Foundations first.** A rectangle with sides x + 5 and x + 4, to scale: headers x and 5 on top in blue, x and 4 at the left in teal. Two cuts, one on each plus: four cells, every term by every term: x² (the square on x), 5x, 4x, 20. The two x-cells are like terms: 9x. Area x² + 9x + 20; the garden variant is this picture with meters. Said once: "a product of two sums has four parts, and two of them are the same kind."

**Read.** "Equivalent to (3x + 1)(2x − 4)" or "the area of the rectangle": the same question. At a glance: the first cell is first times first (leading term), the last is last times last (the constant, with the sign the sign rule gives); the middle is the sum of two cells and is the only place work is needed. Choices with the wrong first or last term die at once.

**The example.** "Which expression is equivalent to (2x − 4)(x − 4)?" Choices: 2x² − 4x + 16 | 2x² − 12x + 16 | 2x² − 12x − 16 | 2x² + 16. Two negatives: no area to draw, so the grid keeps equal cells and the signs ride in them (said once). Headers 2x, −4 at the left; x, −4 on top. Fill: 2x · x = 2x²; 2x · (−4) = −8x; −4 · x = −4x; −4 · −4 = +16 (negative times negative, from signed numbers). Light the two x-cells gold together: −8x and −4x: −12x. 2x² − 12x + 16. Rule out: 2x² − 12x − 16 has the wrong constant sign; 2x² + 16 has no middle at all: that is first times first and last times last, two cells of four; 2x² − 4x + 16 kept one middle cell and dropped the other. x = 1 proves the survivor: (−2)(−3) = 6; 2 − 12 + 16 = 6.
Quick second case, one negative: (3x − 1)(2x + 6): 6x², 18x, −2x, −6; the middle cells have opposite signs and partly cancel: 16x. 6x² + 16x − 6. x = 1: (2)(8) = 16; 6 + 16 − 6 = 16.

**Fast.** Four cells, then add the two middle ones.
**Sense.** The constant's sign follows the sign rule; the middle is there unless the two cells cancel exactly.
**Check.** x = 1: the product of the factors' values must equal the sum of the answer's coefficients.
**Line.** "Every term by every term, then sort."
**Trap.** The two-cell answer (2x² + 16), the "first times first, last times last" habit; and the constant's sign with two negatives. The grid has four cells and the two middle ones light together; −4 · −4 is written +16 in rust-to-teal on the word.
**Kit.** `area` with terms, `g.power.1` highlight; `dim`.
**Writer.** A capable cheaper model: one grid, decoys fixed, the arithmetic machine-checked.

### `structure-meaning` — What a number in the formula means

**One case does not fit the method.** The ball's 40 (initial upward speed) cannot be read by "set t to 0, step t by one"; it is a fact about the model h = −16t² + (launch speed)t + (launch height), owned by family 15's projectile lessons. The lesson teaches it from units, as below, and the alignment list should note that this variant is physics knowledge, not expression structure.

**Standard.** HSA.SSE.A.1a "interpret parts of an expression, such as terms, factors, and coefficients" in context; HSF.LE.B.5 "interpret the parameters in a linear or exponential function in terms of a context"; 8.F.B.4 "interpret the rate of change and initial value."

**Foundations first.** Two moves that read any formula. Collapse at zero: drop in 0 for the input; every term with the input in it vanishes; what is left is the starting value, the amount before anything happened. Step by one: a table with inputs 0, 1, 2; if the same amount is added each row, that amount is the rate, and it is the number multiplying the input ("per"); if each row is the previous times the same number, that number is the growth factor, and it is the base of the power. Units: a number that multiplies "sessions" to give "dollars" is dollars per session.

**The example.** "A tutor charges C dollars for s sessions, C = 45 + 15s. What does 45 represent?" Choices: total cost for one session | the number of sessions | the cost of each session | a fixed charge paid whatever the number of sessions. Table: s = 0: 45 + 0 = 45; s = 1: 60; s = 2: 75. At zero sessions you still pay 45: a fixed charge. The rows climb by 15: 15 is the cost of each session. Rule out: "the number of sessions" is the letter s, not 45; "total for one session" is 60, in the table; "cost of each session" is the 15, the step. Dim together. The fixed charge.
Second example, a different model: "P = 3500(1.05)^t. What does 1.05 represent?" t = 0: 3500, the start. t = 1: 3500 × 1.05 = 3675; t = 2: 3858.75. Each row is the last times 1.05: a growth factor; times 1.05 is the whole plus 5 hundredths of it: grows 5% a year (family 16's line, word for word). Rule out: "grows by 1.05 people each year": the rows grow by 175, then 183.75, not by a fixed amount; "population after one year" is 3675; "at the start" is 3500.
Quick third, flagged: "h = −16t² + 40t + 39. What does 40 represent?" Collapse at t = 0: 39 feet, the height at release. 40 multiplies seconds and the result is feet, so 40 is feet per second: a speed, the speed when the ball leaves the hand; the −16t² is gravity pulling it back down (one line, owned by quadratics). Rule out by numbers: the height after 1 second is −16 + 40 + 39 = 63; the greatest height is more than that, 64 at t = 1.25. Neither is 40.

**Fast.** Drop in 0 for the start; step by one for the rate or the factor; read units for anything multiplying the input.
**Sense.** The starting value has the output's units; a rate has "per"; a growth factor is a plain number near 1.
**Check.** The table: the chosen meaning is true in every row.
**Line.** "Zero in for the start. Step by one: added is a rate, multiplied is a factor."
**Trap.** Reading a growth factor as an amount added ("grows by 1.05 people"); taking the constant as "the cost for one". The table's rows show the difference between adding 15 and multiplying by 1.05, and 60 sits in the s = 1 row.
**Kit.** `substitute`, `table`; `dim`.
**Writer.** Strongest: three families' voices must agree word for word, and the ball case is reasoning from units that no machine checks.

### `structure-rewrite` — See the shape, name the square (pilot 5)

**Standard.** HSA.SSE.A.2: "use the structure of an expression to identify ways to rewrite it. For example, see x⁴ − y⁴ as (x²)² − (y²)²." The 6.EE.A.2 tag is wrong; retag.

**Foundations first.** Two rectangles worth knowing by sight, drawn to scale once. The square of a sum: a square of side a + b cut into a², ab, ab, b²: three parts, two squares and the double. The difference of two squares: a square of side a with a b-square cut from one corner in rust; the L cut along one line; the strip turned and moved to make a rectangle (a + b) wide and (a − b) tall: a² − b² = (a + b)(a − b). Then the move: a chunk in parentheses can be one quantity. Box (x + 3); it fades to u. Say "treat it as one quantity" as the whole point.

**Read.** "Which product equals", "which square is equal to", "as a difference of two squares": each is "which of the two shapes is this, and what are A and B?" At a glance: a square minus a number that is a square (16, 49, 2401) is a difference of squares; three terms whose ends are squares is a candidate for the square of a sum, and the middle must be twice A times B.

**The example.** "Treat (x + 3) as a single quantity. Which product equals (x + 3)² − 16?" Choices: (x − 1)² | (x − 1)(x + 7) | (x − 13)(x + 19) | (x − 7)(x + 1). (1) Box (x + 3); it fades to u: u² − 16. (2) 16 is 4²: u² − 4², a difference of squares: (u − 4)(u + 4); the named rectangle lights. (3) u un-collapses: (x + 3 − 4)(x + 3 + 4) = (x − 1)(x + 7). Rule out by x = 0: the given is 9 − 16 = −7; (x − 1)² gives 1 and (x − 13)(x + 19) gives −247: dim together; (x − 7)(x + 1) also gives −7, so x = 1 finishes: the given is 16 − 16 = 0; (0)(8) = 0; (−6)(2) = −12. Dim. Say it: when two survive, a second number decides.
Second example, the other shape: "Which square is equal to 4x² − 28x + 49?" Choices: (4x + 49)² | (2x + 7)² | (4x − 7)² | (2x − 7)². A = 2x, because (2x)² = 4x²; B = 7. The middle must be 2 · 2x · 7 = 28x, and it is, with a minus: (2x − 7)². Rule out: square the first term of each choice: (4x)² is 16x², so two die together; (2x + 7)² has +28x in the middle.
Quick third, the standard's own example: "x⁴ − 2401": x⁴ is (x²)²; 2401 is 49²; (x² − 49)(x² + 49). Decoy (x − 49)(x + 49) multiplies to x² − 2401, the wrong power.

**Fast.** Name A and B; write the matching product; put the chunk back.
**Sense.** Multiplied back, the product's first term and constant must match the given's.
**Check.** x = 1 on the given and the chosen product; or multiply the product out.
**Line.** "Treat it as one quantity. Solve the small problem, then put it back."
**Trap.** Expanding (x + 3)² first and factoring x² + 6x − 7 from scratch: slow but true, so the lesson shows it is not wrong, only long. The sign-swapped product (x − 7)(x + 1): the un-collapse writes 3 − 4 and 3 + 4 in place. Reading 4x² as (4x)²: the square's side is 2x, drawn.
**Kit.** `square` (both presets), `box`, `step` with a chunk fading to u and back; `dim`.
**Writer.** Strongest: the insight is the staging of the fade and the un-collapse, and three recognitions live under one name.
