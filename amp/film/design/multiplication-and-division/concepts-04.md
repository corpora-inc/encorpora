# Multiplication and division, part 4: concepts for ten problem types

Grades 4 to 6: multiples, the three-digit algorithm, two-digit divisors, remainders read from the story, and the shared side. Every concept below stands on the family design's foundations 6 to 13 and names them in one line; none re-teaches them.

---

### Grade 4: factors-multiples (4.OA.B.4)

#### `multiples-select` — Select every multiple of a one-digit number. Select-many.

**Standard.** 4.OA.B.4: "Determine whether a given whole number in the range 1–100 is a multiple of a given one-digit number." Every variant stays in range; the three wordings (full sets, "counting by", "a multiple is 8 times a whole number") are one question.

**Foundations first.** Foundation 12, built in front of the learner: *multiple* means the number times a whole number, which is the same as a landing when you skip count by it, which is the same as rows of it with nothing left. Draw it: a number line 0 to 80, hops of 8 drawn as arcs with "+8" on each, landings labeled 8, 16, 24 ... 80. Say once: "The landings are the multiples. Everything in between is not."

**Read.** "Packs come in sets of 8. Which counts are full sets with nothing left over? Select every multiple of 8." Choices 47, 73, 72, 56, 48. "Multiple of 8" goes gold. At a glance: a multiple of 8 is even, so 47 and 73 are gone before any work. No count of answers is given, so every choice is decided on its own.

**The example.** (1) The hop line is already drawn. (2) Each choice drops onto it: 48 lands on a landing; 56 lands; 72 lands; 47 drops one short of 48; 73 drops one past 72. (3) The two near misses are the whole trick: in rows of 8, 72 is exactly 9 rows (an array, 9 rows of 8, every row full); 73 is the same array with one rust dot that cannot start a row. (4) 48, 56, 72.

**Fast.** Skip count by the number past the biggest choice, or divide each choice and keep remainder 0. For 2, 5 and 10 the ones digit decides (even; 0 or 5; 0): that always works and is place value, said in one line. For 3, 4, 6, 7, 8 and 9 within 100, skip counting is faster than any rule.

**Sense.** A choice one more or one less than a landing can never be a landing; that is where every decoy in this type sits (47 and 73 here; 23 and 9 beside 24 and 8; 21 and 44 beside 20 and 45; 41 and 50 beside 42 and 49).

**Check.** Divide each chosen one: 48 ÷ 8 = 6, 56 ÷ 8 = 7, 72 ÷ 8 = 9, remainder 0. Divide one unchosen: 73 ÷ 8 = 9 R 1.

**Rule out.** For an even divisor, odd choices dim together ("not even: gone"). For 5, anything not ending in 0 or 5. For 7 and 3 there is no glance; hop.

**Line.** "A multiple is a landing. One past the landing is not."

**Trap.** Choosing 73 or 41 because it is "close" or because it contains the digit (41 for 7s, 73 for 7s). The drop beside the landing, and the rust dot that cannot start a row.

**Kit.** `numberline` with `hops` and `drop`; `array` with `leftover`; `dim`.

**Writer.** A capable cheaper model: one picture, one method, the decoys fully named here.

---

### Grade 5: multidigit-products (5.NBT.B.5)

#### `multiply-multidigit` — Multiply a three-digit number by a two-digit number.

**Standard.** 5.NBT.B.5: "Fluently multiply multi-digit whole numbers using the standard algorithm." The only generated variant is 842 × 69; the goal also promises two-digit by two-digit, which `multiply-two-digit` already owns.

**Foundations first.** Foundation 9, named: "In grade 4 you cut the rectangle by place, counted each part, and added." The one new idea, said as the point of the moment: the standard algorithm does that cut in two rows, one for the ones digit of 69 and one for its tens, and the tens row counts tens, so it starts in the tens place. Picture, drawn to scale: a rectangle 842 wide and 69 tall is a long strip; the camera pushes in on its left end, where the horizontal cut at 9 | 60 is visible, the thin band labeled 9 × 842 and the thick band 60 × 842 outside with leaders. Then: "Too long to draw the parts. The numbers in their places are the picture now."

**Read.** "What is 842 × 69?" At a glance: about 800 × 70 = 56,000, so five digits, fifty-something thousand. Last digit: 2 × 9 = 18, so it ends in 8.

**The example.** The chart-headed stack, 842 over 69, standard style. (1) Ones row, 9 × 842, place by place from the right: 9 × 2 = 18, write 8, carry 1; 9 × 4 = 36 and 1 is 37, write 7, carry 3; 9 × 8 = 72 and 3 is 75: 7,578. The carries fade when the row is done. (2) Tens row: "this row is 60 × 842, so it starts in the tens place": the placeholder 0 is written tinted in the ones place on that word. 6 × 2 = 12, write 2, carry 1; 6 × 4 = 24 and 1 is 25, write 5, carry 2; 6 × 8 = 48 and 2 is 50: 50,520. (3) Add: 58,098. (4) The rectangle's two bands read 7,578 and 50,520 beside the two rows.

**Fast.** The standard algorithm: ones row, tens row shifted one place, add. For a two-digit factor this is always two rows.

**Sense.** Near 56,000; ends in 8; the tens row is far bigger than the ones row, as the thick band is far bigger than the thin one.

**Check.** 69 is one less than 70: 70 × 842 = 58,940, minus 842 is 58,098. A different route to the same number, in three lines.

**Line.** "The tens row starts in the tens place."

**Trap.** The missing placeholder zero (7,578 + 5,052 = 12,630, far below the estimate): the rectangle's thick band is 60 rows, not 6, and the zero is written on the word. Adding the carry before multiplying ((4 + 1) × 9 instead of 9 × 4 + 1): the voice says "times, then add the carry" on every column.

**Kit.** `stack` with `"op": "×"`, standard style, per-row carries that fade, the tinted placeholder on a word; `area` zoomed to an edge with leader labels.

**Writer.** A capable cheaper model once `multiply-two-digit` exists: one added idea on a reference layout.

---

### Grade 5: multidigit-quotients (5.NBT.B.6)

#### `mcas-true-quotient-equations` — Which division equations are true? Select 2 of 5, or true/false per equation.

**Standard.** 5.NBT.B.6: "using strategies based on ... the relationship between multiplication and division." The equations are written answer first (602 = 18,631 ÷ 31); the lesson reads them aloud in that order so the film looks like the problem.

**Foundations first.** Foundation 6 named: a division equation is a multiplication with a hole, so it is true exactly when quotient × divisor = dividend. Then the two glances, each built once: the last digit of a product is the last digit of the last digits' product, so a quotient whose product cannot end right is false in a second; and the size, from the rounded divisor. Said plainly: these two can only say no. Only multiplying back says yes.

**Read.** "Choose the 2 equations that are true." Choices: 420 = 672 ÷ 16; 106 = 4,664 ÷ 44; 98 = 3,861 ÷ 39; 159 = 3,718 ÷ 22; 78 = 1,794 ÷ 23. "True" goes gold; exactly two.

**The example.** (1) Last digits: 98 × 39 ends in 2 (8 × 9 = 72) but 3,861 ends in 1: gone. 420 × 16 ends in 0, 672 in 2: gone. The two dim together. (2) Size: 3,718 ÷ 22 is about 3,700 ÷ 20, under 190; 22 × 160 = 3,520 and 22 × 170 = 3,740, so the answer sits between 160 and 170; 159 is too small: gone. (3) Two remain and the question asks for two, but each is still proved: 106 × 44 in a two-row stack: 424 and 4,240 make 4,664 ✓. 78 × 23: 234 and 1,560 make 1,794 ✓. (4) Both chosen.
Quick second case, the true/false pairs: each equation decided alone, both answers possible. 602 × 31 ends in 2, 18,631 in 1: false. 506 × 33 ends in 8, 16,698 ends in 8, and 16,500 ÷ 33 is 500, so it passes both glances; multiply: 1,518 and 15,180 make 16,698: true.

**Fast.** Last digit, then size, then multiply back only what survives.

**Sense.** The size estimate; a quotient near the dividend (420 from 672) is nonsense on sight.

**Check.** The multiplication back is the check; read the chosen equation aloud as "106 times 44 is 4,664."

**Rule out.** As above; the dims come in two beats (digits, then size) with one reason each.

**Line.** "The last digit can only say no. Multiply back to say yes."

**Trap.** Trusting a passed digit test as proof: 159 × 22 ends in 8, like 3,718, and is false (169 × 22 is the true one). Dividing each dividend out by hand instead of multiplying the given quotient, which is slow and error-prone.

**Kit.** `stack ×`, `dim` in sets. Nothing new.

**Writer.** A capable cheaper model: a stated three-tier drill.

#### `divide-by-two-digit` — Divide up to four digits by a two-digit number.

**Standard.** 5.NBT.B.6: "quotients of whole numbers with up to four-digit dividends and two-digit divisors ... Illustrate and explain the calculation by using ... area models."

**Foundations first.** Foundation 10, the handoff said once: division is the missing side, and with a two-digit divisor the rectangle is filled in chunks. Draw it to scale: a rectangle 31 tall, "?" wide in gold, area 899 inside. Say what the bracket beside it records: each chunk's width goes over the dividend's places; each chunk's area is subtracted. And the estimating move: round the divisor to a ten to guess each digit, multiply to check, adjust once.

**Read.** "What is 899 ÷ 31?" At a glance: about 900 ÷ 30 = 30, two digits, twenty-something or thirty. Last digit: the quotient times 31 ends in 9, so the quotient ends in 9.

**The example.** (1) The bracket, headers over the quotient. First part: 89 tens. 90 ÷ 30 suggests 3; 3 × 31 = 93 is more than 89: too big, so 2. The 3 is struck, 2 written over the tens. On the rectangle a chunk 20 wide slides in, 620 inside, "left: 279" counting down; the bracket subtracts 62 from 89: 27, bring down the 9: 279. (2) 279 ÷ 31: 280 ÷ 30 suggests 9; 9 × 31 = 279, exactly. A chunk 9 wide fills the rest; the camera follows the thin strip so it reads. (3) The widths add: 29. Nothing left.
Second example, fully worked because it is a different case: 4,850 ÷ 97, a zero in the quotient. At a glance: 97 is almost 100, 4,850 ÷ 100 is about 48, so about 50. 48 is less than 97, so the first digit stands over the tens: 485 ÷ 97, estimate 5, 5 × 97 = 485, nothing left. Bring down the 0: 0 ÷ 97 is 0, written tinted over the ones. Quotient 50, one chunk 50 wide filling the whole rectangle.

**Fast.** Estimate each digit from the rounded divisor, multiply, adjust once if too big or if what is left is at least the divisor, subtract, bring down.

**Sense.** The estimate; the number of quotient digits comes from where the divisor first fits.

**Check.** Multiply back: 29 × 31 = 870 + 29 = 899. 50 × 97 = 4,850.

**Line.** "Guess from the rounded divisor. Multiply. Adjust once."

**Trap.** Keeping the first guess when its product is too big (93 from 89, then a negative or a wrong borrow): the strike-and-replace is the lesson. Stopping at 5 for 4,850 ÷ 97: the brought-down 0 still needs a digit over the ones, and 5 × 97 is nowhere near 4,850.

**Kit.** `area` with `chunk` and `follow`; `longdiv` with `guess`, `adjust`, tinted 0, headers.

**Writer.** Strongest writer: the chunk-to-bracket handoff and the adjustment are the design.

#### `quotient-remainder-blanks` — How many full groups, how many left. Two blanks from choices.

**Standard.** 5.NBT.B.6 for the quotient; 4.OA.A.3 "problems in which remainders must be interpreted" for the sentence, which asks for both. Every variant is the same sentence, so this is one method, not a mixed type. The slot choices are not in the facts output; the writer should read them before scripting the rule-out.

**Foundations first.** Foundation 11 drawn: 761 candies, bags of 36; a rectangle 36 tall filled in chunks; what will not fill a column sits in rust at the right. Define *full bags* (the width) and *left over* (the rust), and the rule that the leftover is always smaller than a bag, or another bag fills.

**Read.** "761 candies are packed into bags that each hold 36. As many bags as possible are filled. Complete the sentence." "As many as possible" and "left" go gold. At a glance: 720 ÷ 36 = 20, so about 20 bags; the leftover will be under 36.

**The example.** (1) Try 20 bags: a chunk 20 wide, 720 inside; left 41. (2) 41 is more than 36: the rust strip is a whole column and five more, so one more bag fills: chunk 1 wide, 36; left 5. (3) 21 full bags, 5 left over. The bracket beside did the same in two steps: 76 ÷ 36 = 2, 72, 4, bring down 1, 41 ÷ 36 = 1, 36, 5. (4) The sentence is filled: 21 full bags and 5 candies left over.
The one-digit-quotient variants (161 ÷ 28 = 5 R 21) are the same picture with one chunk and are covered by the method.

**Fast.** Divide; if the leftover is at least a group, one more group; stop when the leftover is smaller than a group.

**Sense.** About 20 bags; leftover under 36.

**Check.** 36 × 21 + 5 = 756 + 5 = 761, written every time.

**Rule out.** A "left over" choice of 36 or more is impossible; a "full bags" choice whose product with 36 passes 761 is impossible.

**Line.** "What's left is always smaller than a group."

**Trap.** Stopping at 20 bags with 41 left over: the rust column that is itself a full bag. Writing the two numbers in the wrong blanks: the full count is the width, the leftover the rust, and the sentence is filled from the picture.

**Kit.** `area` `chunk`, `longdiv`, two-blank slots on the board.

**Writer.** A capable cheaper model once `divide-by-two-digit` exists: one fixed story shape, one method. (The family design filed it with the mixed types; the generated variants are not mixed.)

---

### Grade 6: integer-division (6.NS.B.2)

#### `long-division-quotient` — Divide a multi-digit number by a two-digit number.

**Standard.** 6.NS.B.2: "Fluently divide multi-digit numbers using the standard algorithm." Both variants divide exactly. The dividend 15312 prints without a comma while every other type uses them; one format.

**Foundations first.** Foundation 10 named: "the bracket records chunks filling a rectangle; you built it last year." One beat on the rectangle, 48 tall, 319 wide, three chunks 300, 10 and 9 with their areas, then the bracket is the picture for the rest. Said once: where the divisor first fits tells where the first quotient digit stands.

**Read.** "A school orders 15,312 sheets packed equally into 48 boxes. How many sheets in each box?" Three numbers: 48 boxes, 15,312 total, each missing: divide. At a glance: 15,000 ÷ 50 = 300, so three digits, about 300. The quotient times 48 must end in 2, so it ends in 4 or 9.

**The example.** (1) 1 is less than 48, 15 is less than 48, 153 is not: the first digit stands over the hundreds. 150 ÷ 50 suggests 3; 3 × 48 = 144, fits; 153 − 144 = 9. Bring down the 1: 91. (2) 90 ÷ 50 suggests 1 (2 would be 96, too big); 48; 91 − 48 = 43. Bring down the 2: 432. (3) 430 ÷ 50 suggests 8; 8 × 48 = 384; 432 − 384 = 48, which is a whole divisor: another fits. 8 is struck, 9 written: 9 × 48 = 432, nothing left. (4) 319 sheets in each box.
6,083 ÷ 79 = 77 is the same method with a divisor that rounds up to 80 (608 ÷ 80 suggests 7, 553; bring down 3, 553 again, 7) and needs no second example.

**Fast.** Where the divisor first fits, estimate from the rounded divisor, multiply, subtract, bring down, adjust when the product is too big or what is left is at least the divisor.

**Sense.** About 300; ends in 9 as the digit test allowed.

**Check.** 319 × 48 = 319 × 50 − 319 × 2 = 15,950 − 638 = 15,312. And the story: 48 boxes of 319 sheets.

**Line.** "If what's left is a whole divisor, one more fits."

**Trap.** Leaving 318 with 48 left over: the remainder is a full column. Misplacing the first digit when it takes three digits of the dividend to fit (3 written over the tens or the thousands): the headers over the quotient, and the voice counting "1, 15, 153: here."

**Kit.** `longdiv` with headers, `guess`, `adjust` upward.

**Writer.** A capable cheaper model once `divide-by-two-digit` exists; the two lessons together show one adjustment each way.

#### `division-remainder-story` — Use the remainder the way the story needs. Mixed type.

**Standard.** 4.OA.A.3: "problems in which remainders must be interpreted"; 6.NS.B.2 for the two-digit divisors. Three kinds under one name: round up (pages, buses), report the leftover (bolts, books left), count full groups (boxes, shelves filled). The lesson teaches reading; there is no recipe to recap.

**Foundations first.** One picture, three questions, before any example: 3,755 bolts in boxes of 30, drawn as a rectangle 30 tall filled to 125 boxes with 5 rust bolts beside it. The same division answers three different questions: how many full boxes (125, the width), how many bolts are left over (5, the rust), how many boxes to hold every bolt (126, because the five still need a box). Say the habit: decide what the leftover will mean before you divide, from the words: "every ... needs", "how many ... needed" means a part-group still counts; "left over" means the rust; "fill completely", "can it fill" means the width only.

**Read.** "An album holds 16 photos on each page. How many pages are needed to hold all 1,726 photos?" "Needed" and "all" go gold: every photo gets a page, so a part-page still counts. Three numbers: 16 each, 1,726 total, groups missing: divide. At a glance: 1,600 ÷ 16 = 100, so a little over 100 pages.

**The example.** (1) The bracket with headers: 17 ÷ 16 = 1, 16, 1; bring down 2: 12 is less than 16, so 0 tens, written tinted; bring down 6: 126 ÷ 16 = 7 (112), 14 left. 107 R 14. On the rectangle, 107 columns of 16 and 14 rust photos beside them. (2) The 14 photos are not on a page. They need one: 108 pages, the last page partly filled. (3) Check: 16 × 107 + 14 = 1,712 + 14 = 1,726.
Second kind, quick: "A factory packs 2,809 bolts into boxes of 58, filling as many as it can. How many bolts are left over?" "Left over" gold: the rust is the answer. 280 ÷ 58: 290 is too big, so 4, 232, 48; bring down 9: 489 ÷ 58 = 8 (464), 25. 48 full boxes; 25 bolts left, fewer than a box. Answer 25. Check 58 × 48 + 25 = 2,809.
Third kind, quick: "A library has 1,174 books to put on shelves that hold 52 each. How many shelves can it fill completely?" "Completely" gold: the width only. 117 ÷ 52 = 2, 104, 13; bring down 4: 134 ÷ 52 = 2, 104, 30. 22 full shelves; the 30 left do not fill a shelf (30 is less than 52), so they do not count. Answer 22.

**Fast.** Read what the leftover means, divide, then do that.

**Sense.** Pages needed is the quotient or one more, never less; the leftover is smaller than a group; full groups is the quotient exactly.

**Check.** Multiply back every time; then re-read the question and say which number it asked for.

**Line.** "Decide what the leftover means before you divide."

**Trap.** Answering 107 pages, which leaves 14 photos out; answering 48 when asked what is left; writing 125 R 5 as the number of boxes; rounding up to 23 shelves when the story said "completely". The question re-read after the division, with the gold word, closes each.

**Recap.** Names each kind by what happens: "Every item needs a place: one more group." "Asked what's left: the leftover." "Asked how many full: the quotient, and the leftover stays out."

**Kit.** `area` `chunk` with `follow` and rust `leftover`; `longdiv` with tinted 0 and `remainder`.

**Writer.** Strongest writer: a mixed type where the reading is the lesson.

---

### Grade 6: gcf-lcm (6.NS.B.4)

#### `greatest-common-factor` — The largest number that divides both.

**Standard.** 6.NS.B.4: "Find the greatest common factor of two whole numbers less than or equal to 100." Four of five variants are stories (identical boxes, bouquets, sets, square tiles) and one is bare.

**Foundations first.** Foundation 13 built: a factor is a side one of the number's rectangles can have (grade 4, named); a *common factor* is a side both numbers can have; the *greatest* is the tallest shared side. Picture: 54 and 72 drawn as rectangles of the same height, side by side. Then the story read, said once: identical boxes with none left over means the number of boxes divides each count, so it is a common factor, and it can never be more than the smaller count.

**Read.** "A baker has 54 muffins and 72 cookies to split into identical boxes with none left over. What is the greatest number of boxes?" "Identical", "none left" and "greatest" go gold. At a glance: both even, so at least 2 boxes; both digit sums are 9, so both divide by 9; even and by 9 means 18 is possible. No more than 54.

**The example.** (1) The sure way: factors of the smaller number from the top, stopping at the first that divides the other. 54: 72 ÷ 54 leaves 18, no. 27: 72 ÷ 27 leaves 18, no. 18: 72 = 18 × 4, yes. The pairs card shows the trials, the misses muted. (2) The picture: 54 as 18 tall and 3 wide, 72 as 18 tall and 4 wide, side by side at one height; each of the 18 columns is one box with 3 muffins and 4 cookies. (3) 18 boxes.
Second example, quick, because the read is different: "A floor 58 feet by 10 feet; the largest whole-foot square tile that covers it with no cuts." A tile side must divide both lengths: a common factor of 58 and 10. From 10 down: 10 (58 no), 5 (58 no), 2 (58 = 2 × 29): 2 feet, the floor gridded 29 tiles by 5. For the bare "GCF of 100 and 20", the first trial is 20 itself and it divides 100: the smaller number can be the answer.

**Fast.** Factors of the smaller from the top; the first that divides the other. Always works and usually stops in one or two trials (95 and 57: 57 no, 19 yes).

**Sense.** At most the smaller number; at least 1.

**Check.** Both divide: 54 ÷ 18 = 3, 72 ÷ 18 = 4, and 3 and 4 share nothing. If the quotients still shared a factor, more boxes would fit.

**Line.** "Common factor: a shared side. Greatest: the tallest. What's left shares nothing."

**Trap.** Answering 9 (both digit sums are 9), a common factor that is not greatest: 54 ÷ 9 = 6 and 72 ÷ 9 = 8 still share 2, so the check fails. Answering a common multiple in a story (216 boxes): more boxes than muffins is nonsense on sight.

**Kit.** `area` `rectangles` and `join` at a shared height; `pairs` with misses muted.

**Writer.** Strongest writer: the shared-side picture is born here and `gcf-factor-sum` stands on it.

#### `least-common-multiple` — The first number both divide.

**Standard.** 6.NS.B.4: "the least common multiple of two whole numbers less than or equal to 12." All variants fit; three are times (lights, bells), three are counts (packs), one bare.

**Foundations first.** Foundation 12 named: a multiple is a landing when you hop by the number. Built: one number line, hops of 6 in blue and hops of 4 in violet from the same 0, the step on each arc. A *common multiple* is a landing both series share; the *least* is the first one. The story read, said once: "every 6 and every 4, the next time together" is the first shared landing, which is never less than the larger number.

**Read.** "Two bells ring together now. One rings every 6 minutes and the other every 4 minutes. In how many minutes will they next ring together?" "Together" and "next" go gold. At a glance: at least 6 minutes; the answer is a multiple of 6.

**The example.** (1) Hops of 6 land at 6, 12, 18, 24; hops of 4 at 4, 8, 12, 16, 20, 24; the arcs grow on the words. (2) The first landing with both colors is 12; it goes gold. 24 is shared too, but later. (3) The sure way beside: multiples of the larger, 6 then 12; stop at the first the smaller divides: 4 does not go into 6; 4 goes into 12. (4) 12 minutes.
Second example, quick, because the question asks for something else: "Cups come in packs of 8 and plates in packs of 3. What is the least number of each you can buy to have equal numbers?" The same count of cups and plates is a shared landing: 8, 16, 24; 3 divides 24. Answer 24 of each: 3 packs of cups, 8 packs of plates. The lights (6 and 5, 30) and hot dogs (8 and 7, 56) are the method with a first shared landing at the product, which happens when the two numbers share no factor; said as a one-line observation, not a shortcut.

**Fast.** Multiples of the larger; the first the smaller divides. With both numbers at most 12 this ends within a few hops.

**Sense.** At least the larger number, at most their product.

**Check.** 12 ÷ 6 = 2 and 12 ÷ 4 = 3: two rings of one bell, three of the other, and the hops show it.

**Line.** "Common multiple: a shared landing. Least: the first one."

**Trap.** Multiplying always (24 minutes for the bells): the line shows a shared landing before 24. Answering the number of packs (3 and 8) when asked the number of each: the question re-read with "number of each" gold. A GCF in a time story (2 minutes): a shared landing is never less than the larger number.

**Kit.** `numberline` with two `hops` series and `meet`.

**Writer.** A capable cheaper model: one picture with named actions, the method stated in full.

#### `gcf-factor-sum` — Write a sum as the GCF times a sum. Multiple choice.

**Standard.** 6.NS.B.4: "Use the distributive property to express a sum of two whole numbers 1–100 with a common factor as a multiple of a sum of two whole numbers with no common factor. For example, express 36 + 8 as 4 (9 + 2)."

**Foundations first.** Two things named, one built. Named: the GCF is the tallest shared side (the lesson before this one), and the cut from grade 3: a rectangle cut in two is two products that add. Built, as the new idea: run the cut backwards. Two rectangles of the same height, 8 tall and 2 wide (16) and 8 tall and 9 wide (72), slide together into one rectangle 8 tall and 11 wide. Two areas added are one area: 16 + 72 = 8 × (2 + 9). The shared side comes outside; what is left of each goes inside.

**Read.** "Use the distributive property to write 16 + 72 as the greatest common factor of 16 and 72 times a sum. Which expression is it?" Choices 8(16 + 9), 8(2 + 72), 8(2 + 9), 4(4 + 18). "Greatest common factor" goes gold. At a glance: the number outside must be the GCF, and the two numbers inside must be what each becomes after dividing by it, so they share nothing.

**The example.** (1) GCF of 16 and 72, from the top of the smaller: 16 (72 ÷ 16 leaves 8, no), 8 (72 = 8 × 9, yes). (2) 16 = 8 × 2 and 72 = 8 × 9, written in the rectangles' colors. (3) The two rectangles slide together: 8(2 + 9). (4) Sense: 8 × 11 = 88, and 16 + 72 = 88.

**Fast.** Find the GCF, divide each number by it, write it outside and the two quotients inside.

**Sense.** The expression's value equals the sum; the number outside is at most the smaller addend.

**Check.** 2 and 9 share nothing, and 8 × (2 + 9) = 88 = 16 + 72. Both halves of the check matter: 4(4 + 18) is also 88.

**Rule out.** 8(16 + 9) and 8(2 + 72): a number inside was never divided (8 × 16 is 128, not 16); they dim together. 4(4 + 18): the value is right but 4 and 18 still share 2, so 4 is a common factor, not the greatest; it dims with that reason. 8(2 + 9) remains and is proved.

**Line.** "Pull the shared side outside. What's left inside shares nothing."

**Trap.** Choosing 4(4 + 18): it checks by value, and a learner who stops at "a common factor" picks it. The inside pair still sharing a factor is the test, and the picture shows the two rectangles at height 4 could be stacked taller. Dividing only one number (8(2 + 72)): both rectangles must be 8 tall before they can join.

**Kit.** `area` `join`; `dim`.

**Writer.** Strongest writer: the cut run backwards is a motion that proves, and the decoy that checks by value needs the reasoning staged, not described.