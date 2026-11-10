# Place value and the base-ten system, K to 6: lesson design

Fifteen skills, 76 problem types (77 with `mental-ten-hundred`, which belongs here). Planning snapshot: `src/curriculum/catalog.ts`, `src/math/engine` templates, `film/facts.ts` for every variant, snapshot 2026-11-08.

Nothing here is a rule list. It is one idea, one picture that grows with the child, and for each problem type: how to read it, the one example that shows the idea, the fastest sure way to the answer, how to know it makes sense, and how to check it.

---

## 1. The idea underneath the whole family

Place value is a single trick applied over and over: **when you have ten of something, you bundle it and call the bundle one of the next thing.** Everything from kindergarten to grade 6 is this trick going up (ones, tens, hundreds, thousands...), going down (tenths, hundredths, thousandths), and the consequences of it. A child who owns the trick owns the family. These are the foundations, in the order they are built; each later lesson stands on the ones above it.

1. **Ten is a thing.** (K) A full ten-frame is not ten counters to count; it is *one ten*. Fourteen is one ten and four. This is unitizing, and nothing else works without it.

2. **The digit counts; the place says what it counts.** (Grade 1) In 38, the 3 does not mean three; it means three *tens*. Every digit is a count, and its position names the unit. The picture that makes this permanent: the digit written directly under the pile of blocks it counts.

3. **Ten of these make one of those, and the amount never changes.** (Grades 1 to 2) Ten squares become a rod; ten rods become a flat. Trading in either direction changes the pieces, never the total. This is the engine of carrying, borrowing, "ten more", and later every decimal algorithm.

4. **Zero holds a place.** (Grade 2) An empty column is not nothing; it is a column that must be written so the other digits keep their places. 406 has no tens, and the 0 is what keeps the 4 in the hundreds.

5. **Nine is the most a place can hold, so the left place wins.** (Grades 1, 2, 4, 5) Everything to the right of a place, all together, is worth less than one of that place: 9 ones and 9 tenths and 9 hundredths still do not make one ten. That is *why* comparing works from the left and stops at the first difference, and why 0.5 beats 0.45.

6. **Rounding asks: which neighbor is closer?** (Grades 3 to 5) Every number sits between two neighbors on the number line (two tens, two hundreds, two tenths). The halfway mark decides, and halfway itself goes up. The "look at the next digit" rule is a *consequence*: the next digit tells which side of halfway you are on. Teach the number line first, then the rule as what the line shows.

7. **Each place is ten times the place to its right.** (Grades 4 to 5) Moving a digit one place left multiplies its value by ten; one place right divides it by ten. Multiplying a number by 10 moves every digit one place left. The point does not move; the digits do (the familiar "move the decimal point" is the same fact seen from the other side, and the lesson says so once).

8. **Every three places the shapes start over.** (Grade 4) Square, rod, flat; then a thousand becomes a new square and we go again: square, rod, flat of thousands; then millions. That is what the commas mark, and why we read "twenty-five thousand, eight hundred sixty": each group is read as a plain three-digit number followed by its name.

9. **The ones place is the center, not the point.** (Grade 4) Going right of the ones, the same trick runs in reverse: cut one into ten equal parts and each is a *tenth* (0.1, 1/10); cut a tenth into ten and each is a *hundredth* (0.01, 1/100); cut again for *thousandths*. Tens and tenths mirror around the ones; hundreds and hundredths mirror around the ones. The point is only a mark that says "the ones are just left of me". This kills the search for a "oneths" place and the belief that the point is the mirror.

10. **Zeros on the end change nothing.** (Grade 4) 0.1 = 0.10 = 0.100 because one rod *is* ten squares *is* a hundred slivers. 1/10 = 10/100 = 100/1000. Writing the zero only names the same amount in smaller pieces. This is what lets us line up decimals of different lengths and compare or add them.

11. **Line up the point and it is whole-number arithmetic.** (Grades 4 to 6) Lining up the points puts ones under ones, tenths under tenths. From there addition and subtraction are exactly the grade-2 algorithm with the same trades. Multiplication needs one new fact (tenths times tenths make hundredths, so count the places). Division by a decimal needs one more (scaling both numbers by ten leaves the quotient alone, so make the divisor whole).

Every lesson below says which of these it stands on, defines what it must define, and shows the one example that makes it visible.

---

## 2. The visual language: squares, rods and flats, drawn to scale, and a camera that zooms

One picture system for all fifteen skills. A fourth grader looking at a hundredths grid must recognize the flat, rod and square they counted in first grade, and understand that only the *name of "one"* has changed.

### The shapes

Exactly three block shapes, always to scale, always with their internal unit lines visible:

| Shape | Size | Grades K to 3 it means | Grade 4+ decimals it means |
|---|---|---|---|
| **square** | 1 × 1 | one | one hundredth (0.01) |
| **rod** | 1 wide × 10 tall, ten squares stacked | ten | one tenth (0.1) |
| **flat** | 10 × 10, ten rods side by side | one hundred | one whole (1) |
| **strip** | 100 wide × 10 tall, ten flats in a row | one thousand (shown once, then shrunk) | |
| **sliver** | 0.1 wide × 1 tall, one tenth of a square | | one thousandth (0.001) |

These are the app's own `baseTen` shapes (teal fill, teal stroke, grid lines), so the lesson's picture is the problem's picture. Rods stand vertical, squares are laid up to five per row, flats up to three per row, exactly as the app lays them out.

The scale is never faked. If a rod is a ten, it is visibly ten squares long. If a rod is a tenth, the flat beside it is visibly ten rods wide. No bar ever stands for an amount it is not the size of.

### The chart

Blocks always stand in a **place-value chart**: one column per place, the place name in small muted capitals under the column, a live count label beside the pile (counts "10, 20, 30" for rods, "100, 200" for flats), and the **digit written directly under its pile** in the digit row. The digit row is the numeral; the child watches the picture become the number.

- The **point** is a large dot in the digit row between the ones and tenths columns, with a faint vertical line through every row of the chart. It never moves. "The point sits beside the ones."
- Columns to the right of the point appear only when the lesson zooms into them (grade 4 onward).
- For numbers of four or more digits, columns are grouped in **periods** of three with a bracket and a name above (ones, thousands, millions, billions) and the comma drawn in the digit row. The bracket is the comma.
- Two numbers being compared are two **rows** of the same chart, each in its own color, aligned on the point.

### Color means one thing each

- **teal** (accent): the number's blocks and digits.
- **rust** (warm): a second number in a comparison, or blocks that are being taken away or traded in.
- **gold**: the one thing being looked at right now: the word in the question that says what is asked ("greater", "value", "nearest hundred"), the rounding digit, the first column where two numbers differ. Only one gold thing on screen at a time.
- **muted**: empty places, placeholder zeros, choices that have been ruled out, and the dimmed rest of the board during a recap.
- Never a tinted background on an answer, never random colors on bars.

### The motions (each one proves a foundation)

- **Fuse** (trade up): ten squares slide into a vertical line and snap into one rod, which slides one column left. Ten rods slide together and snap into a flat. The count labels tick down and up as they go; the **total label never changes**. Foundation 3 made visible.
- **Split** (trade down): a flat slides right and breaks into ten rods; a rod breaks into ten squares.
- **Shift** (×10 or ÷10): every block morphs into the next shape (square to rod, rod to flat) while sliding one column left; the digit under it slides too; the point stays. Reverse for ÷10. Foundation 7.
- **Zoom in** (define a smaller place): the camera pushes into one flat until it fills the frame and its label reads "1 whole"; its ten rods are now tenths. Push into one rod: its ten squares are hundredths. Push into one square: ten slivers appear: thousandths. Each push is the same move ("cut it into ten equal parts") so the child sees that tenths, hundredths and thousandths are one idea repeated. Foundation 9.
- **Shrink** (start a new period): a strip of ten flats (one thousand) is too big to keep drawing, so the camera pulls back until the strip is the size of a square, labeled 1,000, and we build again: ten of them a rod of thousands, ten of those a flat of thousands, then shrink again for a million. The shrink *is* the comma. Foundation 8.
- **Scan** (compare): a gold column highlight walks from the left across both rows and stops at the first column whose digits differ; the greater pile pulses. Foundation 5.
- **Drop** (round): on a number line, the two neighbors are labeled, a halfway tick is drawn, and the number drops onto the line as a dot; the shorter distance to a neighbor is drawn. Then the camera zooms to the next scale for the next rounding place. Foundation 6.
- **Catchment**: the stretch of a number line that rounds to a given value is shaded, closed at its lower end (filled dot) and open at its upper end (hollow dot). Used for every "which numbers round to" type.
- **Dim** (multiple choice): choices that cannot be right fade to muted together, in one beat, with the one reason said aloud ("these two are in the 700s and 800s: gone"). Nothing is struck out one by one.

### The number line

Second picture, used for reading points, ordering, and rounding. Always: the two labeled ends, tick marks, the **step written on an arc between two ticks** (so the child counts jumps, never ticks), a halfway tick when rounding, and a smooth zoom between scales (3,000 to 4,000, then 3,000 to 3,100, then 3,080 to 3,090) with the point held fixed. The decimal number line is the same object: 4.9 to 5.0 cut in ten is hundredths.

### Column arithmetic

The kit's `stack` already draws the standard algorithm. For this family it gains the chart's place headers above the columns and the point line, so a stacked 0.80 + 9.26 looks like the chart the child learned in grade 1, with the trades drawn as the same fuse the blocks did.

### Money

A penny is a square, a dime is a rod, a dollar is a flat. Coins are drawn to scale (the app's `coins` figure) and the lesson says this once: cents are hundredths of a dollar, which is why money is written with two places.

---

## 3. One concept per problem type

### The habits every film builds, and how

The learner we are making reads a problem and knows, before doing anything, what it is asking, what is already known, what the answer must look like, and how to prove it right. Every film in this family builds that in the same five moves, so the habit becomes automatic:

1. **Read.** The problem is read aloud exactly as the app shows it. The word that says what is asked goes gold ("greater", "value", "nearest hundred", "how many coins"). One beat says what the answer must look like before any work ("it ends in two zeros", "it is a teen number", "it is one of these two neighbors").
2. **At a glance.** One beat names what is known with no work at all: the digit that decides, the choices that are nonsense, the neighbor that is obviously closer.
3. **The sure fast way.** The shortest path that always works, shown on the picture. Where a shortcut exists that never fails, it is taught as the method, with the picture that explains why it works. A shortcut that sometimes fails is never taught.
4. **Sense.** Before the answer is boxed: an estimate or the picture that says the size is right ("about ten", "still in the 400s", "less than one").
5. **Check.** After the answer: the exact check (add back, multiply back, count from the other end, read the statement aloud and ask if it is true). For multiple choice, the ruled-out choices dim together with the reason, then the chosen one is proved.

Below, each type gives: standard; what the learner must be thinking; **Read** (what it really asks, what is known at a glance); the one example fully worked with the picture; **Fast** (the sure shortest way); **Sense**; **Check**; **Rule out** for multiple-choice types; the line to remember; the trap and why the lesson makes it impossible. More than one example only where the type truly holds different cases, with the reason.

---

### Kindergarten: teen-place-value (K.NBT.A.1)

**`teen-frame-compose` — One ten and extra ones.** Foundation 1.
Thinking: a full frame *is* ten; the answer is a teen number whose first digit is the full frame and whose second digit is the loose counters.
Read: "One frame is full. How many altogether?" At a glance: the answer is between 10 and 19, and it starts with 1.
Example: a full frame and a second frame with 8 counters. Picture: full frame (teal), second frame with 8 (rust). (1) The full frame is ten: its label reads 10, no counting. (2) Count on along the loose counters: eleven, twelve ... eighteen; the second frame's label ticks 1 to 8, the total label 11 to 18. (3) 18 drops under the frames: the 1 under the full frame, the 8 under the loose ones. (4) Eight-teen is eight and ten.
Fast: say ten, then count the loose ones; or just read the loose count as the second digit.
Sense: a teen number, since one frame is full and the other is not.
Check: the two digits match the two frames.
Line: "A full frame is ten."
Trap: counting all eighteen one by one and losing count. The lesson never counts the full frame.

### Grade 1: tens-and-ones (1.NBT.A.1, 1.NBT.B.2)

**`tens-ones-model` — Read tens and ones.** Foundations 2 and 3.
Thinking: the rod count is the first digit, the square count the second; no adding needed.
Read: "What number do these tens and ones show?" At a glance: the number of rods is the first digit; with 9 rods the answer is in the nineties.
Example: 9 rods and 8 squares (nine is the most a place can hold). (1) Define the rod: ten squares slide together and fuse. (2) Chart tens | ones; count rods 10, 20 ... 90, the label ticking. (3) Count on squares 91 ... 98. (4) Digits drop: 9 under the rods, 8 under the squares: 98. (5) Ninety-eight: "ninety" is nine tens.
Fast: count the rods, write it; count the squares, write it.
Sense: 9 rods is almost a flat, so the number is almost 100.
Check: count by tens, then by ones, aloud.
Line: "The digit counts; the place says what."
Trap: 9 + 8 = 17. Impossible here: the rod is visibly ten squares and its label counts 10, 20, 30.

**`continue-count-to-120` — Continue counting.** Foundations 3 and 4.
Thinking: the next number is one more; only the ones digit changes unless it is a 9, which rolls to 0 and bumps the tens.
Read: "Count on by ones: 38, 39, □." At a glance: if the last ones digit is not 9, copy the tens and add one to the ones; if it is 9, a new ten is coming.
Example: 38, 39, □. (1) 3 rods, 8 squares. (2) One more square: 39. (3) One more: ten squares fuse into a rod and slide left: 4 rods, 0 squares: 40; the digit row shows 39 becoming 40.
Quick second case (a different look): 108, 109, □: the nine squares and one more fuse: 110. Kills "1010".
Fast: ones digit plus one; a 9 becomes 0 and the tens go up by one.
Sense: it is the number you say right after in the counting song.
Check: count back one from the answer.
Line: "After nine comes a new ten."
Trap: 39 → 310, 109 → 1010. The fuse makes the trade visible; one digit per column.

### Grade 1: compare-two-digit (1.NBT.B.3)

Shared idea: nine ones can never make a ten, so the tens decide; only a tie in the tens sends you to the ones.

**`open-number-line-to-120` — Place and read numbers on an open number line to 120.** Multiple choice.
Thinking: find the step from two labels, then count jumps from the nearest label.
Read: "Which number is at P?" At a glance: P sits between two labels, and nearer one of them; the answer is between those labels.
Example: labels 20, 70, 120; ticks every 10; P two jumps left of 120; choices 100, 90, 110, 80. (1) 20 to 70 is five jumps; 50 split in five is 10 each: the step is 10, written on an arc. (2) P is nearer 120, so start there. (3) Two arcs left, each −10: 110, 100. (4) P is 100.
Rule out: P is on the 120 side of halfway between 70 and 120, so 80 and 90 dim together. Two remain; count.
Fast: nearest label, count arcs.
Sense: P is nearer 120 than 70, and 100 is.
Check: count from 70: 80, 90, 100.
Line: "Find the step first."
Trap: counting ticks instead of jumps. Only arcs are ever counted.

**`compare-two-digit` — Compare tens and ones.**
Thinking: tens first; a difference there ends it.
Read: "Which is greater (or less)?" The asked word goes gold; at a glance, if the tens digits differ, the answer is known.
Example: "Which is greater: 76 or 93?" (the ones point the wrong way). (1) Two rows: 76 teal, 93 rust, digits under. (2) Scan stops at tens: 7 rods against 9. (3) The 6 loose squares slide beside one rod and are shorter than it: nine ones can't beat a ten. (4) 93.
Fast: compare the tens digits; only if equal, the ones.
Sense: 76 is in the seventies, 93 in the nineties.
Check: count up by tens from 76 and you pass 93 only after 90.
Line: "Tens first. Nine ones can't beat a ten."
Trap: 76 because 6 > 3. The squares-beside-a-rod picture ends it.

**`two-digit-symbol` — Compare with <, = or >.** Multiple choice, three signs.
Read: the two numbers are in a fixed order; the only question is the sign. At a glance: "=" is out unless every digit matches, so it is one of two.
Example: "Compare 47 and 74." Same digits swapped: place is all that differs. Tens 4 against 7: 47 is less. The sign is drawn between the piles, small end at the small pile, open end at the big one; read left to right: 47 is less than 74. Quick beat: a pair like 38 and 38, every column equal: "=".
Rule out: "=" dims (digits differ). Fast: tens first.
Check: read the chosen statement aloud as a sentence and ask if it is true.
Line: "Small end to the small number."
Trap: right order, wrong sign. The sign is built from the pile sizes.

### Grade 1: ten-more-less (1.NBT.C.5, 1.NBT.C.6)

**`ten-more-or-less` — Change one ten.** Foundation 2.
Thinking: ten more is one more rod; the squares never move, so the ones digit is copied.
Read: "ten more" or "ten less" goes gold. At a glance: the answer ends in the same digit as the given number.
Example: "What is ten more than 69?" (1) 6 rods, 9 squares. (2) A rust rod arrives in the tens and turns teal: 7 rods. The squares never move. (3) 79: the 6 becomes 7, the 9 stays.
Quick cases, different motions: ten less than 65: a rod leaves: 55. Ten more than 96: ten rods fuse into a flat: 106.
Fast: tens digit up or down by one; copy the ones.
Sense: ten more is a little bigger and ends the same.
Check: the two numbers differ by exactly 10; count by ten from the start.
Line: "Ten more: one more rod. The ones stay."
Trap: 69 + 10 = 70. The squares do not move.

**`subtract-whole-tens` — Subtract bundles of ten.**
Read: both numbers are whole tens, so the answer is a whole ten; at a glance it ends in 0.
Example: "The model shows 30. Take away 10." (1) 3 rods, label 30. (2) One rod turns rust and leaves. (3) Two rods remain; the label counts 10, 20: 20.
Fast: subtract the tens digits, write the 0.
Check: 20 and 10 make 30.
Line: "Count what is left by tens."
Trap: answering 2. The label reads 20.
Note: the seed "10 take away 10 = 0" is degenerate; seed 30 − 10 or 50 − 20.

### Grade 2: hundreds-place-value (2.NBT.A.1, 2.NBT.A.3)

**`place-value-digit` — Value of a digit.** Foundation 2.
Read: "value" (gold), not the digit; and which place. At a glance: a hundreds value ends in 00, a tens value in 0.
Example: "In 876, what value does the digit in the hundreds place represent?" (1) 8 flats, 7 rods, 6 squares, digits under. (2) The hundreds column goes gold. (3) Count the flats: 100 ... 800. (4) 800.
Fast: the digit followed by its place's zeros.
Sense: 800 is most of 876.
Check: 800 + 70 + 6 = 876.
Line: "The digit counts; the place says what."
Trap: answering 8. The count label under the flats reads 800.

**`open-number-line-to-1000` — Place and read numbers on an open number line to 1,000.** Multiple choice.
Read: the labels give the step; the point or the number asked is between two labels. At a glance: which label is it nearer?
Example: labels 500 and 750 five jumps apart: 250 split in five is 50 each; a point two jumps right of 750 is 850. For "which point is at 800" on a 0 to 1,000 line with jumps of 100: two jumps back from 1,000.
Rule out: letters on the wrong side of the nearest label dim together.
Fast: nearest label, count arcs. Check: count from the other label.
Line: "Find the step first."
Trap: assuming the step is 10 or 100. It is computed on screen every time.

**`hundreds-model` — Read hundreds tens and ones.** Foundations 2 and 4.
Read: flats, rods, squares, in that order, are the three digits. At a glance: the flat count is the first digit; if a kind is missing, there is a 0.
Example: 5 flats, 1 rod, 2 squares. (1) Define the flat once: ten rods fuse. (2) Chart; count flats 100 ... 500, rods 10, squares 1, 2. (3) Digits drop: 512.
Quick second case (an empty place): 4 flats and 6 squares; the tens column is empty; a muted 0 drops: 406.
Fast: write the three counts in order, 0 for a missing kind.
Sense: 5 flats means the five hundreds.
Check: 500 + 10 + 2 = 512.
Line: "Zero holds the place."
Trap: 46 for 406. The empty column is drawn and the zero drops into it.

**`expanded-form-missing` — Complete expanded form.**
Read: "222 = 200 + □ + 2": the box sits between the hundreds and the ones, so it is the tens value. At a glance: it is the middle digit followed by one 0.
Example: 222 built; the three 2s count different things. Each column becomes an addend under it: 200, 20, 2. The box is 20.
Fast: middle digit × 10.
Sense: the three parts shrink left to right.
Check: 200 + 20 + 2 = 222.
Line: "Each place is an addend."
Trap: writing 2. The addend under the rods is 20.
Note: only the tens are ever hidden, and the film seed "600 = 600 + □ + 0" is degenerate. Hide any one place; never seed a hidden 0.

**`exchange-base-ten` — Exchange equal units.** Foundation 3.
Read: "Trade ten tens for one hundred. How many hundreds will there be?" At a glance: the answer is the hundreds now plus one per trade; with 14 tens there is exactly one trade.
Example: 2 flats, 14 rods, 7 squares (347). (1) Total label 347 appears and stays. (2) Ten rods turn rust, slide together, fuse into a flat, slide left, turn teal. (3) 3 flats, 4 rods, 7 squares; the total still reads 347. (4) Three hundreds.
Fast: hundreds + 1; tens − 10.
Sense: the model's value cannot change; only the pieces do.
Check: 200 + 140 + 7 and 300 + 40 + 7 are both 347.
Line: "Ten of these make one of those. The amount never changes."
Trap: forgetting the leftover rods or thinking the number changed. The unchanging total and the four standing rods make both impossible.

### Grade 2: compare-three-digit (2.NBT.A.4)

**`compare-three-digit` — Compare three-digit numbers.** Foundations 4 and 5.
Read: greater or less (gold). At a glance: if the hundreds differ, done; if they match, the tens decide.
Example: "Which is greater: 109 or 190?" (1) Two rows: 1 flat, 0 rods, 9 squares; 1 flat, 9 rods, 0 squares. (2) Scan: hundreds tie; tens 0 against 9; stop. (3) The 9 squares slide beside the 9 rods: nothing to compare. 190.
Fast: first difference from the left.
Sense: 109 is barely past 100; 190 is nearly 200.
Check: scan the other direction gives the same answer; or count from 109 by tens and you never reach 190 without passing it.
Line: "Start at the left. The first difference decides."
Trap: "109 has more ones". Squares beside rods.

**`three-digit-symbol` — Three-digit <, = or >.** Multiple choice.
Read: fixed order; only the sign is asked. At a glance: "=" only if every digit matches.
Example: 168 and 175: hundreds tie, tens 6 against 7: 168 < 175, small end to 168. Quick second case: 138 and 138: every column equal: "=".
Rule out: "=" dims when any digit differs.
Check: read it aloud as a sentence.
Line: "Small end to the small number. Equal only when every digit matches."

**`mental-ten-hundred` — Ten or one hundred more or less (2.NBT.B.8).** Skill `mental-tens-hundreds`; it belongs in this family. Foundation 3.
Read: +10 or −10 changes the tens; +100 or −100 the hundreds. At a glance: the ones digit of the answer is the ones digit given; the answer differs from the start by exactly 10 or 100.
Example: 891 + 10. (1) 8 flats, 9 rods, 1 square. (2) A rod arrives; ten rods fuse into a flat and slide left: 9 flats, 0 rods, 1 square: 901. The square never moved.
Quick second case: 706 − 10: no rods to take; a flat splits into ten rods; one leaves: 696.
Fast: change one digit by one; a 9 rolls to 0 and bumps the left neighbor; a 0 borrows and becomes 9.
Sense: 891 + 10 is just past 900.
Check: subtract back: 901 − 10 = 891.
Line: "Ten more is one more rod. If the rods reach ten, they become a flat."
Trap: 8101, or 700. The fuse and the split are the lesson.

### Grade 3: round-whole-numbers (3.NBT.A.1)

Shared picture: the line with two neighbors, the halfway tick, the drop. The digit rule is shown as what the line says.

**`round-to-ten` — Round to the nearest ten.** Foundation 6.
Read: "nearest ten" (gold): the answer ends in 0 and is one of the two tens around the number. At a glance: 728 sits between 720 and 730, and 8 is past 5.
Example: 728. (1) Define rounding: name the closer of the two tens. (2) Line 720 to 730, halfway 725. (3) 728 drops right of halfway; the gap to 730 (2) and to 720 (8) are drawn. (4) 730. (5) The rule as a consequence: the ones digit tells the side; 5 or more is at or past halfway.
Quick second case: 396: neighbors 390 and 400; past 395: 400 (the hundreds change).
Fast: ones digit 5 or more: up; else down.
Sense: 728 is close to 730.
Check: the answer is within 5 of the number.
Line: "Which neighbor is closer? Halfway goes up."
Trap: 396 → 390. The line names 400 as the neighbor.
Note: the seed "Round 20" is degenerate.

**`round-to-hundred` — Round to the nearest hundred.**
Read: the answer ends in 00; the neighbors are the two hundreds around the number. At a glance: the tens digit decides; 449 has tens 4, so down.
Example: 449. (1) Neighbors 400 and 500, halfway 450. (2) 449 drops a hair left of 450: closer to 400 even though it ends in 9. (3) The tens digit, 4, is below halfway. (4) 400.
Quick second case: 150: exactly halfway; up: 200.
Fast: tens digit only.
Sense: 449 is still "four hundred something" below 450.
Check: 449 is 49 from 400, 51 from 500.
Line: "Only the next digit decides."
Trap: looking at the last digit. The dot sits left of 450.

**`number-line-between-hundreds` — Which number is the point?** Multiple choice.
Read: ends 1,700 and 1,800, a tick every 10: the answer is a multiple of 10 between the ends. At a glance: is P past halfway (1,750)?
Example: P at 1,760; choices 1,706, 1,860, 1,760, 1,740. (1) The gap is 100 in 10 jumps: each 10, on an arc. (2) Halfway 1,750; P is one past it. (3) Six arcs from 1,700: 1,760.
Rule out: 1,706 is not a multiple of 10 and 1,860 is outside the ends: both dim at once. P is past halfway, so 1,740 dims. 1,760 remains; prove it by counting.
Fast: anchor at the halfway tick and count from there.
Check: four arcs back from 1,800: 1,760.
Line: "Find the step: the gap divided by the jumps."
Trap: 1,706. Arcs are labeled +10.

**`round-place-blanks` — Round one number three ways.**
Read: three roundings of one number, each from the original. At a glance: the tens rounding is the closest to the number, the thousands the farthest; each answer ends in the right zeros.
Example: 6,599. Three zooms of a fixed dot: (1) 6,000 to 7,000, halfway 6,500, past: 7,000. (2) 6,500 to 6,600, halfway 6,550, past: 6,600. (3) 6,590 to 6,600, halfway 6,595, past: 6,600 (the 9 tens roll).
Fast: for each place, look only at the next digit; start from the original every time.
Sense: all three are near 6,599; the thousands one farthest.
Check: each answer is within half its place of the original.
Line: "Each rounding starts from the original."
Trap: rounding the rounded number; a 9 that rolls. The fixed dot and three zooms.

**`round-addends-sum` — Round each addend, then add.**
Read: "estimate by rounding each addend": the question wants the sum of the rounded numbers, not the exact sum. At a glance: the answer ends in 0 (tens) or 00 (hundreds).
Example: 93 + 74 to the nearest ten. (1) 93 drops: 90. (2) 74 drops: 70. (3) Stack: 160. (4) It is a different number from 167 on purpose; each rounding moved at most 5.
Fast: round each, add.
Sense: within 10 of the exact sum.
Check: 167 is near 160.
Line: "Round first, then add."
Trap: adding exactly, then rounding (170). The question is read with "rounded" gold.

**`mcas-round-hundred-select` — Select the numbers that round to a hundred.** Select 2 of 5.
Thinking: every hundred owns a stretch of the line, from 50 below up to but not including 50 above.
Read: "which 2 round to 900": the stretch is 850 to 949. At a glance: anything not in the 800s or 900s is gone.
Example: 943, 736, 850, 950, 843. (1) Line 700 to 1,000; catchment of 900 shaded from 850 (filled) to 950 (hollow). (2) Each price drops: 943 inside; 850 on the closed end, inside; 950 on the open end, belongs to 1,000; 843 and 736 outside. (3) 943 and 850.
Rule out: 736 (700s) dims at once; 843 (800s with tens below 5) dims; 950 is the boundary and goes up.
Fast: in the 900s, tens digit 0 to 4; in the 800s, tens digit 5 to 9.
Check: exactly two chosen; each is within 50 of 900 and not at 950.
Line: "Halfway goes up, so the stretch starts at 850 and stops just before 950."
Trap: 950. The hollow dot.

### Grade 4: large-place-value (4.NBT.A.1, A.2, A.3)

Shared picture: the period chart built once by the shrink. Numbers are always **slotted from the right** (ones first), which names every digit's place without counting.

**`place-shift-value` — Value of a digit after it shifts.** Foundation 7. Two cases because the question comes in two shapes.
Read: left is ten times, right is a tenth; ×100 is two places and two zeros. At a glance: the new value has the same digit with one more or one fewer zero.
Case A: "In 754, the 7 (700) moves one place right." 7 flats morph into rods as they slide; the 7 slides under them: tens, 70.
Case B: 5,842 × 100: every digit slides two columns left; the emptied columns get zeros: 584,200; moved 2 places.
Rule out (slot choices): any value with the wrong number of digits dims; left means more digits, right means fewer.
Fast: write the digit with one more or one fewer zero.
Sense: a move left makes it bigger.
Check: 70 × 10 = 700; 584,200 ÷ 100 = 5,842.
Line: "One place left: ten times. One place right: a tenth."
Trap: "one more" or "twenty times". The morph shows ×10 twice.

**`number-name-numeral` — Match a number name and a numeral.** Multiple choice; two directions.
Read: match words and digits. At a glance: count the groups: "twenty-five thousand" means two digits before the comma; the first word of the name is the first digit.
Case A, numeral to words: 62,090: brackets thousands | ones; "sixty-two" + "thousand", then "ninety" (the 0 hundreds is not spoken).
Case B, words to numeral: "one thousand, three": three slots per period; "three" fills the ones group as 003: 1,003.
Rule out: choices with the wrong number of digits before the comma dim at once; then any whose first group does not match.
Fast: read in groups; each group is a plain three-digit number plus its name.
Check: say the chosen numeral aloud and match word by word; count the digits.
Line: "Say each group as a plain number, then its name. Every group has three slots."
Trap: dropping or adding zeros, swapping groups. Three slots per period.

**`large-number-line-point` — Read or locate a number on a large number line.** Multiple choice.
Read: the labels give the step. At a glance: P's side of halfway; the answer is a multiple of the step.
Example: 0 to 500,000 in five jumps: 100,000 each; P two arcs from 0: 200,000. Locating 70,000 counts arcs to it.
Rule out: not a multiple of the step, or on the wrong side of halfway.
Fast: nearest label, count arcs. Check: from the other label.
Line: "Find the step: the gap divided by the jumps."

**`multidigit-digit-value` — Value of a digit.**
Read: "value of the digit 9" (gold). At a glance: count the digits to the right of the 9; the value is 9 followed by that many zeros.
Example: 56,970: two digits right of the 9: 900. The chart confirms: slot from the right, the 9 lands in hundreds.
Quick second case: 7 in 4,185,670,103: four digits to its right: 70,000; the chart extends to billions.
Fast: digit, then as many zeros as digits to its right. Always works for whole numbers.
Check: slot and read the header.
Line: "Count the digits to its right; that many zeros."
Trap: the digit alone. The header is the value.
Note: the goal says six digits; variants reach ten. Align them.

**`compare-multidigit` — Compare large numbers.** Two cases.
Read: greater or less. At a glance: count digits (or commas): more digits wins, no scan needed.
Case A: 69,733 or 162,501: slotted from the right, 162,501 reaches a column 69,733 does not. Case B: 926,794 or 926,879: scan; hundreds 7 against 8.
Fast: digit count, then first difference.
Sense: 162,501 is over a hundred thousand; 69,733 is not.
Check: scan again from the left; same answer.
Line: "Longer wins. Same length: the first difference decides."
Trap: 98,765 > 102,345 because 9 > 1. Slotting shows the extra column.

**`round-large` — Round large numbers.**
Read: "nearest thousand": the answer ends in 000 and is one of two neighbors. At a glance: the hundreds digit decides.
Example: 17,618: neighbors 17,000 and 18,000, halfway 17,500; drop, past; 18,000. Quick second case: 950,000 to the nearest hundred thousand: exactly halfway; 1,000,000 (a new digit).
Fast: the next digit.
Sense: 17,618 is more than 17,500.
Check: within 500 of the number.
Line: "Which neighbor is closer? The next digit tells."
Trap: 49,700 → 49,000 or 40,000. The line names 50,000 first.

**`digit-value-ratio` — Ten times the place to its right.**
Read: "how many times as much": the answer is a power of ten. At a glance: count the places between the two digits; 1 followed by that many zeros.
Example: 23,253: the two 3s are three places apart; arrows hop ×10, ×10, ×10: 1,000.
Fast: count the steps; that many zeros after a 1.
Check: 3 × 1,000 = 3,000.
Line: "Each step left is another times ten."
Trap: 30, or "three times". The hops multiply.

**`place-value-forms-select` — Select the forms equal to a number.** Select 2 of 5; two cases.
Read: statements about one number. At a glance: an expression whose biggest term has the wrong number of zeros is gone; a comparison of a number with itself cannot be "greater" or "less".
Case A: 61,521: 60,000 + 1,000 + 500 + 20 + 1 yes; 61,000 + 521 yes; 615 × 10 + 21 = 6,171 no (too few digits). Case B: write each name in digits in the chart and scan.
Rule out: wrong digit count first; then the self-comparison.
Fast: turn every statement into a number.
Check: exactly two chosen; each re-read.
Line: "Turn every statement into a number, then compare."

**`number-between-bounds` — A number between two numbers.** Multiple choice.
Read: strictly between; the ends do not count. At a glance: a choice equal to a bound is gone; compare leading digits.
Example: 67,099 < n < 68,932; choices 68,932, 65,410, 70,621, 68,541. Hollow dots at the bounds; drops: 68,541 inside.
Rule out: 68,932 equals a bound; 65,410 and 70,621 are outside by their leading digits. All three dim at once.
Check: read both inequalities aloud for the chosen one.
Line: "Between means strictly inside; the ends don't count."

**`true-comparison-statement` — Which comparison is true?** Multiple choice.
Read: numbers share leading digits. At a glance: find the first place where the given numbers differ; every statement is decided there.
Example: 400,181,869 < 470,181,869: ten millions 0 against 7; true. For a chain, scan three rows once; the true chain increases at that place.
Rule out: a chain not increasing at the deciding place dims.
Check: read the chosen statement aloud, each sign in words.
Line: "Start at the left; the first difference decides."

**`order-whole-numbers-slots` — Order whole numbers into places.**
Read: the direction (gold: lowest to highest, or highest to lowest). At a glance: the shared leading digits do nothing; one column decides.
Example: 85,582, 85,700, 85,829, 85,661: the scan passes ten thousands and thousands, stops at hundreds: 5, 7, 8, 6; order by that column; a tie would go to the next column.
Fast: one column.
Check: read the finished list in order; each is greater than the last.
Line: "One column decides them all."
Trap: a later digit changing the order. The scan never looks past the deciding column.

**`digit-place-names` — Name the place of every digit.**
Read: five digits means the leftmost is ten thousands. Slot from the right, naming columns. Short.
Check: re-read the values. Line: "Slot from the right."

**`expanded-whole-slots` — Build a number from its place values.**
Read: "sum of the values of its digits, greatest to least, skip zeros". At a glance: the number of terms is the number of nonzero digits.
Example: 80,645: 80,000 + 600 + 40 + 5; the empty thousands column adds nothing.
Fast: each digit followed by as many zeros as digits to its right.
Check: add the terms.
Line: "Each place is an addend; a zero adds nothing."
Trap: 8,000 for the 8. Count the digits to its right: four.

**`compare-symbol-blanks` — Choose the symbol for two comparisons.**
Read: a sum must be added first. At a glance: if the sum's parts are exactly the other number's digits in their places, it is "="; otherwise compare lengths, then scan.
Example: 2,000 + 100 + 40 + 7 against 2,147: "="; 33,463 against 34,466: thousands 3 against 4: "<".
Check: read each aloud. Line: "Make both numbers plain, then start at the left."

### Grade 5: powers-of-ten (5.NBT.A.1, 5.NBT.A.2)

**`multiply-power-of-ten` — Multiply by 10, 100 or 1,000.** Foundation 7.
Read: × 10, 100, 1,000 or 10ⁿ: the count of zeros (the exponent) is the number of places. At a glance: the answer is bigger, and its digits are the same digits in the same order.
Example: 4.93 × 100 (digits cross the point). (1) 4.93 in the chart. (2) Two shifts left: blocks morph up, digits slide, the point stays. (3) 493. Quick second case: 72 × 10³: three shifts; zeros fill: 72,000.
Fast: shift the digits left by the number of zeros; fill with zeros.
Sense: 4.93 is almost 5; 5 × 100 = 500.
Check: divide back by 100.
Line: "Times ten: every digit one place left. The point stays."
Trap: 3.6 × 100 = 3.600. The digits cross the point on screen. The film says once that "move the point two places right" is the same picture from the point's side.

**`divide-power-of-ten` — Divide by 10, 100 or 1,000.**
Read: dividing by a power of ten makes it smaller; same digits, same order. At a glance: count the zeros.
Example: 60 ÷ 10³: three shifts right; the 6 lands in hundredths; empty ones and tenths get zeros: 0.06. (52,900 ÷ 100 = 529 and 1,870 ÷ 10² = 18.7 are the same shift without fill.)
Fast: shift right by the number of zeros; fill with zeros; drop a trailing zero after the point.
Sense: 60 split into a thousand parts is far less than one.
Check: 0.06 × 1,000 = 60.
Line: "Divide by ten: every digit one place right."
Trap: 0.6. The empty tenths column gets its zero.

**`fl-decimal-by-tenth-hundredth` — Multiply or divide by 0.1 and 0.01.**
Read: × 0.1 is ÷ 10 and shrinks; ÷ 0.1 is × 10 and grows; a missing factor means undo. At a glance: the digits stay; the operation sets the direction.
Example: 95.1 ÷ 0.01. (1) A flat holds 100 squares: 1 ÷ 0.01 = 100. (2) So it is × 100: two shifts left: 9,510. Quick second case: □ × 0.1 = 8.9: undo the ÷ 10: 89.
Fast: rewrite as ÷ 10, ÷ 100, × 10 or × 100, then shift.
Sense: dividing by a tiny number gives a big answer.
Check: 9,510 × 0.01 = 95.1.
Line: "Times a tenth is divide by ten. Divide by a tenth is times ten."
Trap: shrinking when dividing by 0.01. The hundred squares in a flat.

**`digit-value-blanks` — Compare two places of the same digit.**
Same lesson as `digit-value-ratio` in sentence form: 868,206, the 8s two steps apart: 100 times. Fast: count the steps. Check: 8,000 × 100 = 800,000.

### Grade 4: decimal-fractions (4.NF.C.5, 4.NF.C.6)

Every film in this skill opens with the same twenty-second definition, drawn live: the flat is one whole; cut into ten rods, each is one tenth, 1/10, 0.1; cut a rod into ten squares, each is one hundredth, 1/100, 0.01; ten hundredths make a tenth, a hundred make a whole; the point sits beside the ones.

**`tenths-as-hundredths` — Tenths as hundredths.** Foundations 9, 10, 11. Two cases: renaming and adding are different acts.
Read: "= □/100" asks for a count of hundredths; "as a decimal" asks for tenths digit then hundredths digit. At a glance: the tenths digit becomes the first digit after the point; the number of hundredths is "tenths digit, hundredths digit" read as a two-digit number (4/10 + 7/100 is 47 hundredths).
Case A, rename: 0.7 = □/100. Definition; 7 rods; cut each into ten: 70 squares; the picture's size has not changed; the chart gains a hundredths column holding 0: 0.7 = 0.70 = 70/100. (4.50 = 4 50/100 is the same with flats in front; one beat.)
Case B, add: 2/10 + 7/100. 2 rods and 7 squares: different sizes, not 9 of anything; rename the rods: 20 + 7 = 27 hundredths; in the chart: 0.27.
Fast: tenths digit, then hundredths digit; that two-digit number is the hundredths.
Sense: 0.27 is about a quarter of the flat.
Check: 27 squares out of 100.
Line: "A tenth is ten hundredths."
Trap: 3/10 + 5/100 = 8/100. Rods and squares are different sizes; nothing is added until they match.

**`decimal-grid-read` — Name a shaded decimal.**
Read: the whole is the grid; the shaded count is the answer in hundredths. At a glance: fewer than ten shaded means 0.0 something.
Example: 9 squares shaded on a hundredths grid. Nine do not fill a column: 0 tenths; 9 hundredths: 0.09. Quick second case: a tenths strip with 3 shaded: 0.3. (A full column, 0.10 = 0.1, one beat.)
Fast: count the shaded squares; write that count as hundredths (9 → 0.09, 34 → 0.34). Always works on the hundredths grid.
Check: 9 of 100.
Line: "Full columns are tenths; loose squares are hundredths."
Trap: 0.9. The empty tenths column gets its zero.
Note: the generated answer "0.10" must also accept "0.1".

**`fl-decimal-tenth-hundredth-step` — 0.1 or 0.01 more or less than a decimal.** Foundation 3 right of the point.
Read: "0.01 more" changes the hundredths digit by one; at a glance every other digit is copied unless a 9 or 0 rolls.
Example: 0.01 more than 4.79 (the trade): one square arrives; ten fuse into a rod: 4.80 = 4.8. (5.74 + 0.01, 3.25 − 0.01, 4.8 + 0.1 are the same move without the trade.)
Fast: change one digit.
Sense: the answer is a whisker from the start.
Check: the two differ by exactly 0.01.
Line: "A hundredth more changes the hundredths. Ten of them make a tenth."
Trap: 1.10 − 0.01 = 1.00. The hundredths column is the one that changes: a rod splits, 1.09.

**`decimal-line-point` — Read a decimal on a number line.**
Read: ends labeled; the step is the gap divided by ten. At a glance: the answer is between the ends with one more decimal place than they have.
Example: 4.9 to 5.0, ten steps of 0.01 on arcs; three arcs from 4.90: 4.93. (0 to 1 with P at 0.5: same, bigger step.)
Fast: nearer end, count arcs. Check: from the other end.
Line: "Find the step: the gap divided by the jumps."

**`decimal-mixed-number-blanks` — A decimal as a mixed number.**
Read: the whole is left of the point; the fraction is the digits after it over 10 or 100 by their count. 7.9: 7 flats, 9 rods: 7 9/10. Check: the fraction is less than one. Trap: 79/10; the flats stay whole.

**`decimal-fraction-locate` — Locate a decimal or a fraction.** Multiple choice (letters).
Read: the target as a count of steps from the labeled end. At a glance: is it in the left or right half of the line?
Example: 0.37 on a hundredths line from 0.3 to 0.4: seven arcs from 0.3. 15/10 on a tenths line: past 1, five arcs on.
Rule out: letters in the wrong half dim together.
Fast: count from the near end. Check: from the other end.
Line: "Find the step first."

**`decimal-place-value-hundredths` — Decimal place value to hundredths.**
Read: place and value of one digit. At a glance: the value is the number with every other digit made zero: 2.98, the 9 → 0.90 = 0.9.
Fast: zero the other digits. Always works.
Check: the values of all digits add to the number.
Line: "Keep the digit in its place; zero the rest."

### Grade 4: compare-decimals (4.NF.C.7)

**`compare-decimals-hundredths` — Compare decimals to hundredths.** Foundations 5 and 10.
Read: greater or less (gold). At a glance: ones first; then give both numbers two places and read them as cents.
Example: "Which is greater: 1.5 or 1.45?" (1) Two rows aligned on the point: 1 flat, 5 rods; 1 flat, 4 rods, 5 squares. (2) 1.5 becomes 1.50; nothing is added to the picture. (3) Scan: ones tie; tenths 5 against 4; stop. (4) 1.5.
Fast: same length, then read as whole numbers (150 against 145).
Sense: 1.5 is halfway to 2; 1.45 is not yet.
Check: scan again; the five loose squares cannot make a rod.
Line: "Line up the point. Zeros on the end change nothing. Start at the left."
Trap: 1.45 because 45 > 5. Rows align on the point, never the last digit.

**`staar-order-decimals` — Order decimals with unlike places.** Multiple choice.
Read: the direction (gold). At a glance: pad to two places and read as cents: 0.5, 0.47, 0.7, 0.8 are 50, 47, 70, 80.
Example: least to greatest: 0.47, 0.5, 0.7, 0.8. For "which is third", count along the order.
Rule out: any chain whose first entry is not the smallest (or largest) dims at once.
Fast: pad, then order whole numbers.
Check: read the chosen chain; each step goes the right way.
Line: "Same length, then start at the left."

**`compare-decimals-symbol-blanks` — Compare decimals with symbols.**
Read: pad both; identical digits mean "=". Example: 0.5 against 0.54 (<), 0.5 against 0.50 (=): the same five rods, named as fifty squares.
Fast: pad and read as cents. Check: read aloud.
Line: "Zeros on the end change nothing."

### Grade 5: decimal-place-value (5.NBT.A.3, 5.NBT.A.4)

First zoom into a square: ten slivers, thousandths, 0.001, 1/1000. Each film opens with the chart to thousandths drawn by zooming.

**`staar-number-word-form` — Number words and place-value units.** Multiple choice; three cases under one name.
Read: which shape is it? At a glance: for a decimal, the smallest term names the last place (0.002 means thousandths); for a whole number, the biggest term sets the digit count; for "21 hundreds", 21 flats are 2,100.
Case A: 600,000 + 70,000 + 5,000 + 900 + 4: fill the chart: 675,904; read by periods. Case B: 8 + 0.9 + 0.01 + 0.002: fill: 8.912; "and" is the point; the decimal digits are read as a whole number named by the last place: eight and nine hundred twelve thousandths. Case C: 21 hundreds, 8 tens, 3 ones: 2,100 + 80 + 3 = 2,183.
Rule out: wrong last-place word (hundredths for a three-place decimal), wrong digit count in a group, a missing "and": dim together.
Check: expand the chosen words back and match term by term.
Line: "Read the decimal digits as a whole number, then say the last place."
Trap: "four hundred four hundredths" for 0.404. The last column is thousandths, gold.

**`decimal-digit-value` — Value of a decimal digit.**
Read: count places after the point. At a glance: zero the other digits: 3.649, the 9 → 0.009. Check: values sum to the number. Short.

**`expanded-decimal` — Decimal from expanded form.** Foundation 4.
Read: which places are named; a missing place is a zero. At a glance: the smallest term tells how many digits follow the point.
Example: 8 × 1 + 5 × 1/10 + 4 × 1/1000: hundredths empty: 8.504.
Fast: fill the chart. Check: three places because thousandths were named.
Line: "Zero holds the place." Trap: 8.54.

**`compare-decimals-thousandths` — Compare decimals to thousandths.**
Read: pad to three places, read as whole thousandths. Example: 2.06 or 2.062: 2.060 against 2.062; thousandths 0 against 2. The idea's check in one beat: 0.3 against 0.299: three rods against two rods, nine squares, nine slivers.
Fast: pad, read as whole numbers. Check: scan. Line: "Same length, then start at the left."

**`round-decimal` — Round a decimal.**
Read: "nearest tenth" means one digit after the point; two neighbors. At a glance: the next digit decides.
Example: 8.256: neighbors 8.2 and 8.3, halfway 8.25; just past: 8.3. The same line serves 5.827 → 6 and 1.488 → 1.49; the place changes, the picture does not.
Fast: the next digit. Sense: 8.256 is just over 8.25. Check: within 0.05.
Line: "Which neighbor is closer? Halfway goes up."

**`inverse-round-decimal` — Find an original decimal.** Multiple choice.
Read: which rounds to 27.6: the catchment 27.55 (filled) to 27.65 (hollow). At a glance: a choice not starting 27.5 or 27.6 is gone; round each remaining choice in your head.
Example: 27.650 (halfway, goes up to 27.7), 27.601 (yes), 27.500 (27.5), 27.549 (just under 27.55: 27.5).
Rule out: 27.500 and 27.549 round to 27.5; 27.650 rounds up to 27.7: dim together.
Check: round the chosen one.
Line: "The stretch starts at the lower halfway and stops just before the upper one."

**`expanded-sum-to-standard` — Write the number from its expanded form.**
Read: the largest term sets the length; missing terms are zeros. Example: 5 × 1,000 + 2 × 100 + 6 × 1 + 3 × 0.1 + 9 × 0.01 + 5 × 0.001: tens empty: 5,206.395.
Fast: fill the chart. Check: the digit count matches the largest and smallest places.
Line: "Fill every place; an empty place is a zero."

**`standard-to-expanded-choice` — Choose the expanded form of a number.** Multiple choice; two cases.
Read: each nonzero digit times its header. At a glance: the first term must match the number's size (8,074 needs 8 × 1,000); the number of terms equals the nonzero digits.
Case A: 2,280.63: 2 × 1,000 + 2 × 100 + 8 × 10 + 6 × 0.1 + 3 × 0.01. Case B from words: "six thousand nine hundred ninety-one and five hundredths": write 6,991.05 first (hundredths means two places; tenths 0).
Rule out: a wrong first term, swapped digits, or the wrong term count: dim together.
Check: add the chosen terms.
Line: "Each digit times its header."

**`rounds-to-select` — Select the numbers that round to a value.** Select n of 5.
Read: catchment of 136.02 at hundredths: 136.015 to 136.025. At a glance: look only at the digit right of the rounding place in each choice.
Rule out: anything 136.03 or more, or below 136.015, dims together.
Check: exactly n chosen; each rounds to the target.
Line: "The stretch starts at the lower halfway and stops just before the upper one."

**`round-decimal-blanks` — Round a decimal to two places.**
Read: two roundings, both from the original. Example: 9.974: to tenths the 9 tenths roll: 10.0; to hundredths: 9.97. Sense: both near 9.974. Check: within half of each place.
Line: "Each rounding starts from the original."

**`expanded-decimal-slots` — Build a decimal from its place values.**
Read: nonzero digits only; 1,023.99: 1 × 1,000 + 2 × 10 + 3 × 1 + 9 × 1/10 + 9 × 1/100. Fast: digit times header, skip zeros. Check: add.

### Grade 4: decimal-money-operations (4.MD.A.2)

**`decimal-sum-difference` — Add or subtract decimals to hundredths.** Foundation 11. Two cases: the subtraction trade across the point is a motion addition never shows.
Read: add or subtract? The verb goes gold ("total", "left", "how much more"). At a glance: estimate with whole numbers (0.8 + 9.26 is about 1 + 9 = 10); the answer has two decimal places.
Case A: 0.8 + 9.26. (1) Blocks: 8 rods; 9 flats, 2 rods, 6 squares. (2) The stack with headers and the point line: ones under ones. (3) 0.8 has no hundredths digit: write 0 (eight rods, no squares). (4) Hundredths 0 + 6 = 6; tenths 8 + 2 = 10, ten rods fuse into a flat: write 0, carry 1; ones 9 + 1 = 10. (5) 10.06.
Case B: 12.06 − 2.25. Hundredths 6 − 5 = 1; tenths 0 − 2: trade one one for ten tenths (a flat splits), 10 − 2 = 8; ones 1 − 2: trade a ten, 11 − 2 = 9: 9.81.
Fast: line up the point, pad with a zero, run the whole-number algorithm.
Sense: about 10; about 10. In a story: a total is more than each part; what is left is less than what you had.
Check: subtract back (10.06 − 9.26 = 0.80); add back (9.81 + 2.25 = 12.06).
Line: "Line up the point, fill with zeros, then it is whole numbers."
Trap: lining up the last digits. Headers make the columns places.

**`money-decimal-story` — Decimal money stories.** A mixed type: four different stories. The lesson teaches reading; one example per kind, acted out with coins and bills.
Read: the cue words decide the story. "Fewest coins": biggest coin first. "Change": payment minus cost, and change is always less than the payment. "Each" or "split equally": a share, always less than the total. "Total": add.
Fewest coins (33 cents): quarter, then 8 left: nickel, three pennies: 5 coins. Total (2.48 + 7.03): stack: 9.51. Change (4 pencils at 51 cents, paid 5 dollars): cost 2.04; count up from the cost to 5.00 the way a cashier does: a penny to 2.05, a nickel to 2.10, four dimes to 2.50, two quarters to 3.00, two dollars to 5.00: 2.96. Equal shares (10 erasers at 73 cents, 5 friends): 10 for 5 is 2 each, so each pays 2 × 0.73 = 1.46; the understanding replaces the recipe.
Sense: change < payment; share < total; a total > each part.
Check: cost + change = payment; share × people = total; recount the coins.
Recap names each kind by what happens in the story.
Proposal: split into three types (fewest coins; totals and change; equal shares). Fewest coins is 2.MD.C.8 coin knowledge, not place value.

**`money-model-decimal` — Bills and coins as a decimal.**
Read: bills are whole dollars (the ones column); coins become the cents (two places). At a glance: the dollars digit is at least the bills' value; six quarters alone are a dollar fifty, so this total is over 2.50.
Example: a 1-dollar bill, 6 quarters, 2 dimes, 1 nickel, 1 penny. (1) Penny is a square, dime a rod, dollar a flat: cents are hundredths. (2) Count coins largest first, label counting: 25, 50, 75, 100, 125, 150; 160, 170; 175; 176. (3) 176 cents is 1.76. (4) With the bill: 2.76.
Fast: count by coin type, largest first; carry each hundred cents into the dollars.
Sense: more than 2.50, less than 3.
Check: 6 × 25 + 2 × 10 + 5 + 1 = 176.
Line: "Cents are hundredths of a dollar."
Trap: 2.6 for two dollars and six cents; a 5-dollar bill as 5 cents. Two places always; the bill sits in the ones column.

### Grade 5: decimal-arithmetic (5.NBT.B.7)

**`decimal-addition` — Add decimals.**
Read: "+". At a glance: about 7 + 7 = 14; two decimal places.
Example: 6.95 + 6.68: stack with headers; hundredths 13, write 3 carry 1; tenths 16, write 6 carry 1; ones 13: 13.63.
Fast: line up the point, whole-number algorithm. Sense: near 14. Check: 13.63 − 6.68 = 6.95.
Line: "Line up the point, then it is whole numbers."

**`decimal-multiplication` — Multiply decimals.** Foundation 11's new fact.
Read: "×". At a glance: estimate (2 × 4.5 is about 9); the places in the answer are the places in both factors added (1 + 1 = 2); the last digit comes from 3 × 4, so the product ends in 2.
Example: 2.3 × 4.4. (1) Why, on one flat: a strip one rod wide crossed by a strip one rod tall overlaps in one square: tenths times tenths make hundredths. (2) 23 × 44 = 1,012, stacked. (3) Hundredths: two places: 10.12.
Fast: multiply as whole numbers, count the places.
Sense: the estimate kills 101.2 and 1.012 at once.
Check: estimate, and the last digit.
Line: "Tenths times tenths make hundredths. Count the places."
Trap: lining up the points. The film never stacks points for a product. (1.5 × 9.4 = 14.10: keep two places, then drop the zero; one beat.)

**`decimal-area-model` — Model decimal products and quotients with area.** Multiple choice; two cases.
Read: a shaded rectangle is a product (rows × columns in hundredths); a missing side is a quotient. At a glance: the product of two numbers under 1 is smaller than either; a shaded rectangle is multiplication, never addition.
Case A: 5 tenths tall, 4 tenths wide: 20 squares: 0.5 × 0.4 = 0.20 = 0.2. Case B: area 0.38, width 2: 38 squares dealt into 2 rows: 19 each: 0.19.
Rule out: "0.5 × 0.4 = 2" (bigger than both factors), "0.5 + 0.4" (a rectangle is a product), "0.5 × 0.5" (the sides are 5 and 4): dim together.
Check: 2 × 0.19 = 0.38.
Line: "Tenths by tenths covers hundredths."

**`budget-category-balance`, `gross-net-pay`, `gross-net-sentence`, `price-count-chain` — money stories.** Mixed types; teach reading. Picture: a bar model, every arithmetic step the stack with the point.
Read: "net" or "take-home" is what is left after everything is taken out; "gross" is before; a missing deduction is gross minus net minus the known ones; "balance" means income equals expenses; "surplus" when income is longer, "deficit" when expenses are longer. Price and count: "each person buys both" means price the pair, then multiply; different counts mean each price times its count, then add.
Sense and rule out (all are multiple choice): a net pay greater than gross dims; a total less than one of its parts dims; a budget change in the wrong direction dims; for a group cost, the answer is more than either item's total.
Check: add the deductions back to net to recover gross; income minus expenses recomputed; the group total two ways (pairs, or by item) agree.
Lines: "Net is what is left after everything is taken out." "Surplus if income is longer; deficit if expenses are longer." "Same pair for everyone: price the pair, then multiply."
Note: `gross-net-sentence` uses whole dollars only. These four belong under `financial-literacy-elementary`, reusing the stack and bar model from here.

### Grade 6: decimal-algorithms (6.NS.B.3)

**`multidigit-decimal-sum` — Add and subtract multidigit decimals.**
Read: the verb. At a glance: estimate with whole numbers: 581 − 566 is about 15.
Example: 580.6 − 566.02: 580.60; hundredths 0 − 2 trade, 8; tenths 5; ones 0 − 6 trade, 4; tens 7 − 6 = 1; hundreds 0: 14.58.
Fast: line up the point, pad, whole-number algorithm. Sense: near 15. Check: 14.58 + 566.02 = 580.60.
Line: "Line up the point, fill with zeros, then it is whole numbers."

**`multidigit-decimal-product` — Multiply multidigit decimals.**
Read: "×". At a glance: about 66 × 1 = 66; places 1 + 2 = 3; last digit 9 × 3 = 27, so it ends in 7.
Example: 65.9 × 1.03: 659 × 103 = 67,877: 67.877.
Fast: whole numbers, count places. Sense: near 66. Check: last digit and estimate.
Line: "Count the places."

**`multidigit-decimal-quotient` — Divide by a decimal.** Foundation 11's second new fact.
Read: "÷" by a decimal: make the divisor whole first. At a glance: 1.943 is less than 2.9, so the answer is less than 1; about 1.9 ÷ 3 is about 0.6.
Example: 1.943 ÷ 2.9. (1) Why, with two bars: 6 ÷ 2 = 3 and 60 ÷ 20 = 3; both stretched ten times, same number of fits. (2) Shift both one place: 19.43 ÷ 29. (3) Long division; the point in the quotient straight above: 0.67. (4) 0.67 × 2.9 = 1.943.
Fast: move both points the same number of places; divide; point straight up.
Sense: less than one; near 0.6.
Check: multiply back.
Line: "Move both points together; the quotient doesn't change."
Trap: moving one point. Both shift in the same beat.
Note: the seed −561 ÷ (−8.5) and variants with negatives are 7.NS; remove from this grade 6 type.

**`decimal-rename-chain` — Rename a fraction or add decimal weights from a table.** Two cases.
Read: a fraction whose bottom fits into 100 is hundredths: 1/4 = 25 squares of the flat, 3/4 = 0.75, 1/2 = 0.5, 1/5 = 0.2, twentieths × 5, twenty-fifths × 4. At a glance: 1.75 + 1 3/4 is doubling, so 3.5.
Case A: 1.75 + 1 3/4: 1 3/4 = 1.75; stack: 3.50 = 3.5. Case B, the table: add the added weights, subtract the removed; for a missing weight, total minus the known ones; stacked on the point.
Sense: a total is more than each part; what is left is less than what was added.
Check: convert the answer back, or add the parts back to the total.
Line: "If the bottom fits into 100, the fraction is hundredths."
Note: the seed 6 − 3 4/5 × 5 = −13 mixes order of operations and a negative result into a decimal type. Keep the two cases above; move the rest to the types that own them.

**`staar-decimal-operations` — Decimal operations in money and measurement stories.** Mixed; teaches reading.
Read: "the same amount each" over weeks: divide, and the share is less than the total. "Each is worth" with a count: multiply; 82 tokens at about 0.2 is about 16. "How many more ... than": subtract, twice if someone used some first, and the answer is less than either amount.
Share (30.87 over 9 weeks): 3.43, point straight above; check 9 × 3.43. Total (82 × 0.17): 13.94, two places; sense near 16. Compare (6 kg, used 2.3, other has 2.8): 6.0 − 2.3 = 3.7; 3.7 − 2.8 = 0.9; the bar model shows what is left and the gap.
Check: multiply back; add back.
Recap names each kind by what happens in the story.
Note: the variant 0.07 − 1/4 = −0.18 has a negative answer; grade 7. Remove.

**`lifetime-income-salary` — Total income over a career.**
Read: years worked is end age minus start age; monthly pay times 12 is yearly; yearly times years is the total; two salaries: the yearly difference times the years, never both totals. At a glance: 43,500 × 36 is about 44,000 × 36, about 1.6 million.
Check: the estimate.
Note: whole numbers only, no place-value idea; belongs under financial literacy.

---

## 4. Tools to build

The kit draws grids, counters, polygons, axes, labels and motion, and has `stack`. This design needs five additions, specified as what they take and what they do.

### 4.1 `blocks`: the place-value chart with base-ten blocks

```json
{ "blocks": { "id": "b", "places": ["hundreds","tens","ones"], "point": false,
  "rows": [ { "id": "n", "value": 347, "ink": "accent", "pieces": {"hundreds": 2, "tens": 14, "ones": 7} } ],
  "periods": true, "digits": true, "counts": "by-place", "total": true } }
```

- `places`: any contiguous run from billions to thousandths. `point: true` draws the dot and the vertical point line between ones and tenths. `periods: true` draws the three-column brackets with names and the commas.
- Each row is a number drawn as piles to exact scale with the app's `baseTen` geometry (square 1, rod 1 × 10, flat 10 × 10; squares up to five per row, rods side by side, flats up to three per row). `pieces` allows noncanonical forms (14 rods). For decimal charts the flat is the whole, the rod a tenth, the square a hundredth, a sliver (0.1 × 1) a thousandth; one shared unit for the whole chart.
- `digits: true` writes each row's digit under its pile; `counts` adds a live label per pile counting in the place's unit (10, 20, 30); `total: true` adds a live total label.
- Parts are addressable: `b.n.tens`, `b.n.tens.3` (a block), `b.n.digit.tens`, `b.place.tens` (the header), `b.point`, `b.period.thousands`.

Actions:

- `{"do":"trade","row":"n","from":"tens","n":10}`: ten pieces turn warm, slide together, fuse into one piece of the next place, slide left, turn the row's ink; counts and digits update; the total label does not change. `"to":"ones"` with `n: 1` is the reverse split.
- `{"do":"add","row":"n","place":"ones","n":1,"ink":"warm"}` and `remove`: pieces arrive or leave; a trade is called by the author on the word.
- `{"do":"shift","row":"n","by":-1}`: every piece morphs into the next shape and slides one column left (positive: right); digits slide; emptied columns receive muted zeros when `"fill":true`.
- `{"do":"zoom","row":"n","into":"ones"}`: the camera pushes into one piece of that place until it fills the frame; the chart extends one place right; the piece's ten parts are drawn and labeled with the new place's name and value. `{"do":"zoom","out":true}` returns.
- `{"do":"shrink","row":"n"}`: the highest period collapses to a single labeled square to start the next period.
- `{"do":"scan","rows":["a","b"]}`: a gold column highlight walks from the leftmost place across all rows and stops at the first column whose digits differ (or at the end for equality); the greater pile pulses. `{"do":"mark","place":"tens"}` for a single gold column.
- `{"do":"zeros","row":"n","places":["hundredths"]}`: tinted placeholder zeros in the digit row.

### 4.2 `digits`: a place-value grid for numerals (extends `stack`)

Numbers written in a chart without blocks: large numbers, comparisons, expanded form, rounding. `stack` becomes this component's case with an operator.

- Options: `headers: true`, `point: true`, `periods: true`; rows of numbers or of expanded-form terms.
- Per-digit parts (`d.row.0.hundreds`) for highlight, slide (`{"do":"slide","digit":"d.0.hundreds","to":"tens"}`), strike, carry and borrow marks, tinted placeholder zeros.
- `{"do":"fill","row":0,"from":"terms"}`: expanded-form terms drop their digits into their columns; zeros appear in untouched columns.
- `{"do":"words","row":0}`: the number name written under the digit row, each period's words under its period.
- `stack` gains `"headers": true` so decimal sums carry their place names.

### 4.3 `numberline`: labeled lines with step arcs, halfway, catchment and zoom

```json
{ "numberline": { "id": "nl", "from": 6000, "to": 7000, "ticks": 10, "labels": [6000, 7000], "point": 6599 } }
```

- Parts: `nl.tick.k`, `nl.label.v`, `nl.point`, `nl.half`, `nl.arc.k` (a jump arc with its "+step" label), `nl.catch` (shaded interval, filled lower end, hollow upper end), `nl.gap.lower` / `nl.gap.upper` (distances from the point to the neighbors).
- Actions: `drop` (the dot falls onto the line), `arcs` (draw jumps one at a time on the counting words), `half`, `catch`, `gaps`, and `zoom` (a smooth change of scale that keeps the point fixed on screen and relabels ends and ticks).
- Decimal lines are the same component with decimal ends and steps.

### 4.4 `money`: coins and bills to scale with a running count

Reuse the app's `coins` scene and add bills; parts per coin; `{"do":"count","order":"largest"}` moves the coins one at a time into a counted row while a label counts 25, 50, 75 ...; `{"do":"as-blocks"}` morphs a penny into a square, a dime into a rod and a dollar into a flat beside the chart, once.

### 4.5 `area` on the hundredths flat

A flat with an a-tenths by b-tenths rectangle shaded, rows and columns countable one at a time, and a missing-side form that deals squares into rows. Serves `decimal-area-model` and the one "why" beat in `decimal-multiplication`.

### 4.6 `dim` for choices

A board action that fades a set of choices to muted together in one beat: `{"do":"dim","choices":[1,3]}`. Replaces striking choices one by one, which the kit already forbids.

### What stays as is

Ten-frames and counters (K), the board, `term`, `watch`, `recap`, `overview`, `stack`'s digit logic, the figure motions, and the bar model from the reference two-step word problem lesson, which serves the money stories unchanged.

---

## 5. The pilot: eight problem types to build first

The pilot covers the whole arc in one sitting: every foundation, every new tool, every grade band, the five habits on every kind of question (open answer, multiple choice, slots, select-many).

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `tens-ones-model` | 1 | The picture is born here: rod defined by fusing ten squares, the chart, the digit under its pile. If this is not beautiful, nothing after it will be. |
| 2 | `exchange-base-ten` | 2 | The trade with the unchanging total: the engine of every algorithm in the family. Exercises `trade`, counts, total label, and the "value cannot change" sense check. |
| 3 | `compare-three-digit` | 2 | The scan from the left with a zero in play (109 vs 190); two rows in one chart; "nine can't beat a ten"; the at-a-glance habit. |
| 4 | `round-to-hundred` | 3 | The line with neighbors, halfway and the drop (449 → 400); the digit rule shown as a consequence. Exercises `numberline`. |
| 5 | `place-shift-value` | 4 | The ×10 morph in both directions; the point that stays put; slot choices ruled out by digit count. Exercises `shift` and the digit row. |
| 6 | `tenths-as-hundredths` | 4 | Zoom into the flat, tenth and hundredth defined, 0.7 = 0.70, tenths added to hundredths, the "read the two digits as hundredths" fast way. Exercises `zoom`. |
| 7 | `compare-decimals-hundredths` | 4 | 1.5 vs 1.45: line up the point, same length, read as cents. The exact misconception standardized tests target. |
| 8 | `decimal-sum-difference` | 4 | 0.8 + 9.26 and 12.06 − 2.25: the stack with headers and the point line, zeros, trades drawn as the grade-2 fuse, estimate first, add back after. |

If the eight land, the next wave is `number-name-numeral` (the shrink and the comma, multiple-choice rule-out), `mcas-round-hundred-select` (catchment and select-many), `multiply-power-of-ten` and `multidigit-decimal-quotient`, which complete the tool set.

---

## What in the app's problem types should change

> Base cases, trivial cases and trick questions (7 - 7, 19 + 0, a square root of 0) are wanted in the app; 7 - 7 matters at an early frontier. Flagging one here only means it is a weak choice for a lesson's main worked example, never that the app should drop it.

Flagged above, collected here.

- `mental-ten-hundred` (skill `mental-tens-hundreds`, 2.NBT.B.8) belongs in this family and is designed above. `add-two-digit`, `regroup-hundreds` and `multiply-tens` are operations that *use* the system; they should adopt this visual language but are not part of this design.
- Degenerate film seeds: `subtract-whole-tens` (10 − 10), `expanded-form-missing` (600 = 600 + □ + 0), `round-to-ten` (round 20). Seed cases with something to see.
- `expanded-form-missing` only ever hides the tens. Hide any one place.
- `decimal-grid-read`: the answer "0.10" must also accept "0.1" or the lesson contradicts the checker.
- `multidigit-digit-value`: the goal says six digits; variants reach ten. Align one with the other.
- `number-between-bounds` reaches seven digits in a grade 4 skill bounded at 1,000,000 by 4.NBT.A.2; fine as a stretch, but say so in the template.
- `multidigit-decimal-quotient`: negative dividends and divisors are 7.NS material; remove from this grade 6 type.
- `staar-decimal-operations`: the variant 0.07 − 1/4 = −0.18 has a negative answer; remove.
- `decimal-rename-chain`: a grab bag (order of operations, mixed numbers, negatives, tables). Keep fraction-to-decimal renaming and the table; move the rest to the types that own them.
- `money-decimal-story`: split into three types (fewest coins; totals and change; equal shares). Fewest coins is 2.MD.C.8 coin knowledge, not place value.
- `budget-category-balance`, `gross-net-pay`, `gross-net-sentence`, `price-count-chain`, `lifetime-income-salary`: financial-literacy applications; two have no decimals at all. Move them under `financial-literacy-elementary` and let them reuse the stack and bar model.

---

## 6. Assigning work through blind comparison

Separate instructional design, screenplay writing, figure building, learner review, and objective checks. Test a proposed assignment on identical inputs before using it for a lesson batch.

| Job | Input | Output | Acceptance criteria |
|---|---|---|---|
| A. Instructional design | The family and generated variants | A per-type concept like Part 3 | Defines the foundation, chooses an illuminating example, identifies a realistic misconception, and supplies valid sense and accuracy checks |
| B. Screenplay | A reviewed concept, AUTHORING.md, and the available kit | Voice lines, board work, and figure actions | Implements the concept with readable pacing and motion synchronized to the words; passes `--dry` |
| C. Figure building | The concept's figure description | Figure JSON and any required component specification | Draws quantities to scale, labels them clearly, and makes the reasoning visible without narration |
| D. Learner review | A storyboard and captions | Specific teaching and visual findings | Identifies missing definitions, unexplained steps, unreadable layouts, and misleading pictures without inventing faults |
| E. Objective checks | The screenplay and generated facts | Reproducible check results | Verifies arithmetic, answer agreement, structural validity, and coverage of the distinct cases |

Use an experienced instructional designer for job A. Run `make.ts --dry` and `facts.ts` for job E; automated checks establish technical and mathematical properties, not teaching quality.

For screenplay comparison, give each candidate the same four pilot concepts: `tens-ones-model`, `round-to-hundred`, `tenths-as-hundredths`, and `decimal-sum-difference`. These span grade bands and components. Produce one lesson per session, run `--dry --board`, allow one repair pass, then freeze the output. Hold the other four pilot types back for confirmation.

For figure comparison, use the 109-versus-190 chart and scan, the 449 number line with halfway and zoom, and the 0.7-to-0.70 zoom. Judge the rendered frames for scale, labels, and the specified motion.

For reviewer comparison, use an agreed set of clear and flawed storyboards. A reviewer must identify the actual teaching faults, accept clear explanations, and name actionable fixes. Keep the writer and reviewer independent.

Anonymize and shuffle the rendered films before independent reviewers rank them and explain their judgments. Accept a writing assignment only when every sample meets the teaching requirements with at most small wording changes. Accept figure work only when all samples are correct, legible, and faithful to the concept. Do not infer reliability from one good output or assign lessons whose required component is absent.

Review every lesson in a new family's first wave. Use sampling only after review is calibrated, and return to full review when a new family or picture system begins. Record durable teaching and tooling improvements in `KAIZEN.md`; keep individual grades and review notes outside this repository.
