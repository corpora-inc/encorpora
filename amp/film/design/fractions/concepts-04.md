# Fractions family, part 4: like-fraction addition, mixed numbers, fraction of a set

Ten problem types in three skills, all grade 4, all standing on foundations 3, 7, 8 and 9. Every film opens with the family's twenty seconds (a bar is one whole; cut into *b* equal pieces, each 1/*b*; shade *a*; the bottom names the piece, the top counts) with *b* chosen to match the lesson, and every film labels the whole with the story's unit. The pieces here are fourths, fifths, sixths, eighths, tenths and twelfths; where a variant uses sixteenths or hundredths the lesson's example stays in grade, and the method is said to be the same with any piece.

Two things cut across the whole set and should be fixed in the app before these films go live:

- **Answers displayed in forms a fourth grader does not use.** 2/4 shown as 1/2; 6/8 liter as 3/4; 16/12 feet as 4/3; 4 1/4 − 2 3/4 liters as 3/2; 25/6 hours; 313/50 liters. 4.NF.B.3 never asks for lowest terms, and 4.NF.B.4c wants "between what two whole numbers", which a mixed number answers and 313/50 hides. The checker must accept every equivalent form (2/4, 1/2; 6/4, 1 2/4, 1 1/2, 3/2), and the displayed canonical answer should be the problem's own pieces or the mixed number. The lessons below say the answer the way a child would, then name the equivalent form once.
- **"Give a fraction or a whole number."** The `mixed-fraction-sum` prompt refuses the mixed number, the one form the story wants. Change it to "Give a mixed number, a fraction or a whole number."

---

## Like fraction addition (`like-fraction-addition`, grade 4)

Shared idea: adding joins pieces of the same whole, subtracting separates them, and the pieces keep their name. The join and separate motions carry every lesson. Foundation 7, with the one-line handoff from place value: "ones with ones, tens with tens; here, fourths with fourths."

### `like-fraction-missing-part` — Find the missing fraction in a sum.

**Standard.** 4.NF.B.3a, "Understand addition and subtraction of fractions as joining and separating parts referring to the same whole," and 3b, "Decompose a fraction into a sum of fractions with the same denominator" (6/4 = 4/4 + 2/4). The displayed answer 1/2 is the only app flag: the pieces are fourths and the checker must take 2/4.

**Foundations first.** The opening in fourths. Then the missing part, named from family 6 in one line: "A whole made of two parts; if you know the total and one part, the other part is what is left over." A total past one whole is a chain of two whole-sized bars with a heavy line at 1, never a stretched bar; the chain is drawn and the heavy line pointed at ("this is one whole") before anything is shaded.

**Read.** "4/4 + □ = 6/4. What fraction is missing?" The box goes gold. The question is: six fourths altogether, four of them known, how many more fourths? At a glance: the answer is in fourths, it is smaller than 6/4, and 4/4 is exactly one whole, so the missing part is whatever sticks out past the whole.

**The example.** 4/4 + □ = 6/4. (1) Chain of two wholes, eight fourths, heavy line at 1. (2) Shade the total: one, two, ... six pieces, count label ticking to 6, "6/4" written under the bar in teal: this is everything. (3) The known part: the first four pieces outline gold, together, and reach exactly the heavy line: "four fourths is one whole." (4) The pieces past the line are the missing part: one, two. The box fills: 2/4. (5) Board: 4/4 + 2/4 = 6/4. One beat: "Two fourths of a whole is also a half: 2/4 = 1/2. Either name is right."

**Fast.** Subtract the counts: 6 − 4 = 2. Keep the piece: fourths.
**Sense.** The known part is one whole, the total is one and a half, so the gap is a half.
**Check.** Add it back: four fourths and two fourths are six fourths.
**Line.** "The missing part is total minus known, in pieces."
**Trap.** Adding the two numbers shown (4/4 + 6/4 = 10/4), the habit from "a plus sign means add"; and subtracting bottoms (2/0). The total is shaded first and the known part sits inside it, so there is nothing to add; the pieces on screen are fourths before, during and after.
**Kit.** `wholes: 2`, counted `shade`, `highlight` on a range of pieces (`b.piece.1-4`), the fraction under the bar. Nothing new.
**Writer.** Cheaper model: one method, one picture, the opening is shared.

### `like-fraction-difference` — How much is left.

**Standard.** 4.NF.B.3d, "Solve word problems involving addition and subtraction of fractions referring to the same whole and having like denominators," and 4.MD.A.2 (liquid volumes, lengths, time, "simple fractions"). The design's section 3 lists this as a mixed type; the facts show one story shape (have some, use some, how much is left), so it is one method whose only reading step is naming the whole. Flags: sixteenths are outside grade 4; answers are shown simplified (1/8 for 2/16, 2/3 for 4/6, 3/5 for 6/10); and the movie variant asks "how much of the movie is left" while the key wants 4/6 of an *hour*; "how much of the movie" reads as 4/5 of the movie. Reword to "How much time is left?"

**Foundations first.** The opening in eighths, with the whole bracketed as the story's unit, not the thing: **1 liter**. Say why: "Seven eighths of a liter is seven pieces of a liter. The whole is the liter." Then the separate motion: pieces turn rust and leave off the right end; the piece label never changes.

**Read.** "Student C has 7/8 liter of juice. Student C drinks 1/8 liter. How much juice is left?" "Left" goes gold: something is taken away. The whole: one liter. At a glance: the answer is in eighths, and it is a little less than 7/8.

**The example.** (1) Bar labeled 1 liter, cut into eighths, first piece named 1/8. (2) Shade seven, counting; 7/8 under the bar. (3) "Drinks one eighth": the last shaded piece turns rust and slides off; the count ticks to 6. (4) 6/8 liter. Board: 7/8 − 1/8 = 6/8. (5) One beat: pairs of eighths merge into fourths, the shading does not move: 6/8 = 3/4 of a liter. "Same juice, bigger pieces. Both names are right; the app shows 3/4."

Quick second case, because its whole is the thing children get wrong: "A movie lasts 5/6 of an hour. Student I has watched 1/6 of an hour. How much time is left?" The whole is the hour, bracketed; five sixths shaded, one leaves: 4/6 of an hour, also 2/3. Three beats.

**Fast.** Subtract the counts, keep the piece. Merge only if you want the smaller name.
**Sense.** A sip from seven eighths of a liter leaves most of the liter.
**Check.** Add it back: 6/8 + 1/8 = 7/8.
**Line.** "Subtract the counts. Keep the piece."
**Trap.** 7/8 − 1/8 = 6/0, or the answer "6": children subtract both numbers or drop the piece. The pieces on screen are eighths the whole time; the answer is read off the bar as "six eighths of a liter."
**Kit.** `separate`, `merge`, the unit bracket. Nothing new.
**Writer.** Cheaper model.

### `fraction-decompositions-select` — Which sums name the shaded amount.

**Standard.** 4.NF.B.3b, "Decompose a fraction into a sum of fractions with the same denominator in more than one way... Examples: 3/8 = 1/8 + 1/8 + 1/8; 3/8 = 1/8 + 2/8; 2 1/8 = 1 + 1 + 1/8 = 8/8 + 8/8 + 1/8," and the head clause, "a fraction a/b with a > 1 as a sum of fractions 1/b." The 1 1/4 and "2 shaded" variants do decompose past one whole, so section 6's note that the type stops under one should be amended. Select 2 or 3 of 5 or 6.

**Foundations first.** The opening in fifths, then the idea as a bracket: 3/5 is three pieces; a bracket over all three reads 1/5 + 1/5 + 1/5; a bracket over the first two and one over the third reads 2/5 + 1/5. "A sum of fifths is a count of fifths. Add the tops; the bottom stays." Brackets are drawn over the bar, never a second bar, so the eye sees one amount named several ways.

**Read.** "The shaded amount on the strips is 3/5. Which sums with denominator 5 name that same shade? Choose 2." "Denominator 5" and "Choose 2" go gold. At a glance: a sum with a different bottom cannot be fifths, so it is gone before any adding; then every remaining sum is just a count of fifths, and the right ones count to 3.

**The example.** Choices: 3/5 + 1/5 | 1/10 + 3/5 | 1/5 + 1/5 + 1/5 | 2/5 + 1/5 | 1/5 + 1/5. (1) Bar, fifths, three shaded, counted. (2) Rule out: 1/10 + 3/5 has a tenth; dims. (3) Count each: 3 + 1 = 4 pieces, too many; 1 + 1 = 2, too few; they dim together with the one reason, "wrong count." (4) Brackets on the bar for the two that remain: three single brackets, then a bracket over two and one over one. Both are the same three pieces. Choose c and d. (5) Board: 3/5 = 1/5 + 1/5 + 1/5 = 2/5 + 1/5.

Second example, a different case: "The strips show 1 1/4 shaded. Which sums with denominator 4 equal that shade? Choose 3." Chain of two wholes; four fourths fill the first whole to the heavy line, one more: five fourths, counted. "One and a quarter is five fourths." 4/4 + 1/4 is the whole and the extra piece; 3/4 + 2/4 is five; five unit fractions; 5/4 + 1/4 is six, too many; four unit fractions stop at the whole; 1/8 + 5/4 has an eighth. Three chosen.

**Fast.** Cross off any sum with a different bottom; add the tops; keep the sums that count to the shaded number.
**Sense.** Every right sum, laid piece by piece, covers exactly the shaded pieces.
**Check.** Exactly the number asked chosen; each chosen sum's tops add to the count.
**Rule out.** Different bottom, gone at sight. Then a top-count bigger or smaller than the shade, gone together.
**Line.** "Same piece: add the counts."
**Trap.** Choosing 3/5 + 1/5 because it "has 3/5 in it"; and reading 1 1/4 as one piece and one piece, two fourths. The bracket count kills the first; the heavy whole line filled by four fourths kills the second.
**Kit.** Brackets over a range of pieces with a TeX label (`{"id":"k","bracket":["b",1,2],"tex":"\\frac{2}{5}"}`), several at once; `dim`. To build.
**Writer.** Cheaper model, once brackets exist.

### `like-fraction-sum-story` — Add two fractions of one whole in a story.

**Standard.** 4.NF.B.3d and 4.MD.A.2, as above; the pizza stories also practice 4.NF.A.2's "same whole" language ("of the same pizza"). Section 3 lists this as mixed; every variant is a join ("together", "in all", "end to end", "then ... more"), so it is one method with a reading step: name the whole. Flags: 16/12 feet shown as 4/3 and 2/10 mile as 1/5.

**Foundations first.** The opening in twelfths, the whole bracketed **1 foot**. Then the join motion: a second bar of the same whole, aligned under the first, its pieces rust; they slide onto the end of the first bar's shading and snap to its cuts; the count keeps going; the piece label never changes. "Only same-size pieces can be counted together." A chain of two feet is on screen from the start, so a sum past one has somewhere to go.

**Read.** "One piece of ribbon is 11/12 of a foot. Another piece is 5/12 of a foot. Placed end to end, how long are they together?" "End to end" and "together" go gold: join. The whole: one foot. At a glance: the answer is in twelfths; 11 + 5 is more than 12, so the ribbon is more than a foot, and less than two.

**The example.** (1) Chain of two wholes labeled 1 foot each, twelfths, heavy line at 1. (2) Shade eleven, counting; 11/12. (3) The second ribbon, 5/12, rust, aligned beneath. (4) Join: the five pieces slide to the end and snap on; the count continues twelve, thirteen ... sixteen. 16/12 of a foot. (5) At twelve the shading crossed the heavy line: twelve twelfths fuse into one whole foot (an outline wraps them). "One foot and four twelfths: 1 4/12." (6) Board: 11/12 + 5/12 = 16/12 = 1 4/12. One beat: four twelfths merge into a third: 1 1/3 feet. "Every name is the same ribbon."

Quick case, three beats, for the trap and the same-whole words: "Student D eats 1/3 of a pizza. A friend eats 1/3 of the same pizza." One bar, thirds; one piece, then one more joins: 2/3. "Still thirds. Two of them. The problem says *the same pizza* because thirds of two different pizzas are not the same size."

**Fast.** Add the counts, keep the piece; if the count reaches the bottom, pull out a whole.
**Sense.** Eleven twelfths is nearly a foot and five twelfths is nearly half: about a foot and a half. 1 4/12 fits.
**Check.** Separate the five twelfths back off: 11/12.
**Line.** "Add the counts. Keep the piece."
**Trap.** 11/12 + 5/12 = 16/24; 1/3 + 1/3 = 2/6. The join snaps rust pieces onto the same cuts, and the piece label is still 1/12; and the sense check: 2/6 is less than 1/3, so it cannot be a third plus more.
**Kit.** `align`, `join`, `wholes`, `trade` (pieces to whole). From the family build.
**Writer.** Cheaper model from this concept; the pilot's `mixed-fraction-difference` will have proven the chain and the trade.

---

## Mixed numbers (`mixed-numbers`, grade 4)

Shared idea: foundation 8. A mixed number is wholes and pieces; a whole is *b* pieces of *b*, so wholes and pieces trade and the amount never changes. All five films open the same way: the opening bar, then a second whole beside it in a chain with the heavy line, then one whole splits into its pieces on the word and the total label does not change: "Six sixths make a whole, the way ten ones make a ten." The first three types are one trade seen three ways; they share this concept and differ only in the question.

### `mixed-to-improper-numerator` — A mixed number as a count of pieces.

**Standard.** 4.NF.B.3c, "Add and subtract mixed numbers with like denominators, e.g., by replacing each mixed number with an equivalent fraction": the replacing is what is practiced; and 3b's "2 1/8 = 8/8 + 8/8 + 1/8."

**Foundations first.** The shared opening in sixths. "1 2/6 is read *one and two sixths*: one whole and two pieces." The word "and" is said on purpose; the digits are not glued.

**Read.** "Write 1 2/6 as ?/6. What is the numerator?" The question mark goes gold: how many sixths in all? At a glance: more than one whole means more than six sixths, so the answer is bigger than 6; it is 6 and a bit.

**The example.** (1) Chain of two wholes in sixths; the first whole fully shaded with its heavy outline, two pieces shaded in the second; label 1 2/6. (2) "How many sixths is the whole?" It splits: one, two ... six pieces, counted. (3) Count on: seven, eight. 8/6. The label 1 2/6 is still true; both names stand under the bar. (4) Board: 1 2/6 = 6/6 + 2/6 = 8/6. The numerator is 8.

**Fast.** Wholes times the bottom, plus the top: 1 × 6 + 2 = 8.
**Sense.** A bit more than one whole is a bit more than six sixths.
**Check.** Group six of the eight back into a whole; two are left: 1 2/6.
**Line.** "A whole is six sixths."
**Trap.** 12/6 or 3/6: the digits glued, or 1 + 2. The split shows six pieces and two more make eight; the heavy outline says the 1 is a whole, not a digit.
**Kit.** `wholes`, `trade` (whole into pieces), two names under the bar. Nothing new.
**Writer.** Cheaper model.

### `improper-whole-part` — How many complete wholes.

**Standard.** 4.NF.B.3c, as above, in reverse.

**Foundations first.** The shared opening in thirds, from the other side: pieces first, then "every three thirds make a whole": three pieces fuse and a heavy outline wraps them.

**Read.** "How many complete wholes are in 7/3?" "Complete wholes" goes gold: the question wants a count of wholes, not a fraction. At a glance: 7 is past 6 (two wholes) and short of 9 (three), so the answer is 2. The app's seed is 4/3; the lesson uses 7/3 so the grouping is seen twice.

**The example.** (1) A chain of three wholes in thirds; seven pieces shaded, counted. (2) Group: the first three fuse into a whole; the next three fuse into a whole; the count of wholes ticks one, two. (3) One piece is left; it is laid against an empty whole and does not fill it: "not a whole." (4) Two complete wholes. Board: 7/3 = 3/3 + 3/3 + 1/3 = 2 1/3.

**Fast.** Divide the top by the bottom; the quotient is the wholes, the remainder is loose pieces.
**Sense.** 7/3 is past 2 (six thirds) and not yet 3 (nine thirds).
**Check.** Two wholes are six thirds; one more makes seven.
**Line.** "Group bottom-many pieces into a whole."
**Trap.** Answering 7, the top, or counting the leftover piece as a third whole. The gold word "complete" and the leftover laid against an empty whole.
**Kit.** `trade` (pieces into a whole), a whole count label. Nothing new.
**Writer.** Cheaper model.

### `improper-fractional-part` — What is left after the wholes.

**Standard.** 4.NF.B.3c, as above. Flag: the method says "Simplify"; an 8/6 seed would display 1/3 for 2/6. Accept the pieces' form.

**Foundations first.** The shared opening in fourths, pieces first, grouped into wholes.

**Read.** "Remove all complete wholes from 11/4. What fraction of one whole remains?" "Remains" and "of one whole" go gold: the answer is loose pieces, named as fourths. At a glance: 11 is past 8 and short of 12, so two wholes leave and three pieces stay. The app's seed is 6/5; the lesson uses 11/4 so two wholes are removed and the leftover is more than one piece.

**The example.** (1) Chain of three wholes in fourths; eleven pieces, counted. (2) Four fuse into a whole, four more fuse: two wholes. (3) The wholes turn rust and slide away. (4) Three pieces remain, still fourths: 3/4. Board: 11/4 = 4/4 + 4/4 + 3/4; remove the wholes: 3/4.

**Fast.** Divide the top by the bottom; the remainder over the bottom is what is left.
**Sense.** What is left is less than one whole, by construction.
**Check.** Two wholes are eight fourths; eight and three are eleven.
**Line.** "The leftover keeps the piece's name."
**Trap.** Answering 3, the remainder alone, or 3/11 (the leftover as a share of all the pieces). The three pieces on screen are fourths of a whole, and the whole they are fourths of is drawn next to them.
**Kit.** Nothing new.
**Writer.** Cheaper model.

### `mixed-fraction-difference` — Pour out, cut off, time left. Pilot lesson 4.

**Standard.** 4.NF.B.3c, "Add and subtract mixed numbers with like denominators," 3d, and 4.MD.A.2 (liquid volume, length, time). Flags: answers shown as 3/2, 3/5, 1/3, 21/25 for 1 2/4 liters, 6/10 liter, 2/6 hour, 84/100 liter; the hundredths variant (4 63/100 − 3 79/100) is in grade (100 is allowed) but cannot be drawn piece by piece; the lesson says once that the method is the same with a hundred pieces to the liter.

**Foundations first.** The shared opening in fourths with the chain labeled **1 liter** on each whole. The trade is the whole lesson, so it gets its own beat before the story: a full liter splits into four fourths on the word; the total label above the chain does not change. "Same juice. Different pieces." Then "pours out" named as separate.

**Read.** "Student F mixes 4 1/4 liters of juice and pours out 2 3/4 liters. How much juice is left?" "Pours out" and "left" go gold. The whole: one liter. At a glance: 2 3/4 is nearly 3, and 4 1/4 is just past 4, so about a liter and a half is left; the answer is in fourths and less than 2 liters. Also at a glance: three fourths must come out, and only one loose fourth is there, so a liter will have to be opened.

**The example.** (1) Chain of five wholes, liters, fourths. Four wholes shaded whole with their heavy outlines, one fourth in the fifth: 4 1/4, the total label. (2) "Pour out two and three fourths liters: two whole liters and three fourths." The three fourths first: "Only one loose fourth. Three cannot leave until a liter is opened." (3) Trade: the fourth whole liter splits into four fourths; five loose fourths now; the total label still reads 4 1/4. Board: 4 1/4 = 3 5/4. (4) Separate: three fourths turn rust and leave; two wholes turn rust and leave. (5) Left: one whole liter and two fourths: 1 2/4 liters. Board: 3 5/4 − 2 3/4 = 1 2/4. (6) One beat: the two fourths merge into a half: 1 1/2 liters; and as pieces, 6/4. "Three names, one amount of juice." (7) The symbolic route as the check, since 3c names it: all to fourths, 17/4 − 11/4 = 6/4.

**Fast.** If the top's pieces are fewer than the pieces to take, trade one whole for *b* pieces first. Then wholes minus wholes, pieces minus pieces. (Or: both to pieces, subtract, regroup.)
**Sense.** Four and a bit minus nearly three is about one and a half.
**Check.** Add back: 1 2/4 + 2 3/4 = 3 5/4 = 4 1/4.
**Line.** "Trade a whole for four fourths before you take."
**Trap.** Taking the small fraction from the big one whichever side it is on: 3/4 − 1/4 = 2/4, answer 2 2/4. The picture refuses it: one loose fourth cannot give up three, and nothing leaves until the liter is opened. The unchanging total label kills "the trade changed the amount."
**Kit.** `wholes` with a unit bracket per whole, `trade` whole to pieces, `separate` of wholes and of pieces, a total label that persists through the trade. The pilot builds these.
**Writer.** Strongest writer. The choreography (trade before take, total unchanged) is the design; a weak author narrates it instead of staging it.

### `mixed-fraction-sum` — Mixed numbers together, with a regroup.

**Standard.** 4.NF.B.3c, 3d, 4.MD.A.2. Flags: the prompt refuses the mixed number (above); answers shown as 313/50, 25/6, 14/3, 17/4. Section 3 lists this as mixed; every variant is a join. The regrouping variants in the facts land exactly on a whole (5 and 6) or use hundredths; the lesson's main example regroups with pieces left over, the case the hundredths variant holds and a fourth grader will meet.

**Foundations first.** The shared opening in sixths, labeled **1 foot** per whole. Then the handoff and the rule of the lesson: "Wholes with wholes, pieces with pieces, the way tens go with tens and ones with ones. And when six sixths pile up, they are another whole."

**Read.** "Student H cuts one board 2 5/6 feet long and another 3 4/6 feet long. How long are the boards together?" "Together" goes gold: join. The whole: one foot. At a glance: wholes 2 + 3 = 5; pieces 5 + 4 = 9, more than six, so the answer is more than 6 feet; nearly 3 plus nearly 4 is about 6 1/2.

**The example.** (1) First chain: two wholes and five sixths, 2 5/6. Second chain aligned beneath, rust: three wholes and four sixths. (2) Join wholes: the three rust wholes slide onto the end of the teal wholes; five wholes. (3) Join pieces: four rust sixths snap on after the five: nine sixths, counted. Board: 2 5/6 + 3 4/6 = 5 9/6. (4) Six of the nine sixths fuse into a whole (outline wraps): six wholes, three sixths. Board: 5 9/6 = 6 3/6. (5) 6 3/6 feet; also 6 1/2 feet, 13/2. The total label reads the same through the fuse.

Quick case, three beats, the app's own exact-whole variant: 2 5/6 + 3 1/6: pieces 5 + 1 = 6, exactly a whole: 6 feet, a whole number. "Sometimes the pieces fill the whole exactly."

**Fast.** Add the wholes; add the piece counts; if the count reaches the bottom, trade for a whole.
**Sense.** Nearly 3 and nearly 4 make about 6 1/2.
**Check.** Separate 3 4/6 back off; or all to sixths: 17/6 + 22/6 = 39/6 = 6 3/6.
**Line.** "Wholes with wholes, pieces with pieces. Six sixths is another whole."
**Trap.** Leaving 5 9/6 as the answer (nine sixths unregrouped), and 9/12 from adding bottoms. The fuse happens on screen as the ninth piece lands, and the piece label is still 1/6.
**Kit.** `join` between chains (wholes and pieces), `trade` pieces to whole. Built by the pilot.
**Writer.** Cheaper model after the pilot, with strong review: one method on a finished tool.

---

## Fraction times whole (`fraction-times-whole`, grade 4)

### `fraction-of-set` — A fraction of a set, the rest of the set, and a multiple of a known share.

**Standard.** Misfiled, as the design noted: "2/5 of 40" is 5.NF.B.4a, "Interpret the product (a/b) × q as a parts of a partition of q into b equal parts; equivalently, as the result of a sequence of operations a × q ÷ b," not 4.NF.B.4, which is *n* × *a*/*b*. The sixth variant ("1/6 of the stickers is 8; how many make 3/6?") does serve 4.NF.B.4a and b, "a multiple of a/b as a multiple of 1/b." Keep it in grade 4 as a bridge with the template saying so. The type holds three questions, so the film has one full example and two quick ones.

**Foundations first.** The whole is the set: forty stickers drawn as counters, and said: "This time the whole is not a bar. It is these forty stickers." Then the two words, each with its motion: the bottom says how many equal groups to cut the set into (rings appear, counters deal round them one at a time, each ring filling evenly); the top says how many groups to take (rings turn teal). The handoff from family 7, once: "Cutting 40 into five equal groups is dividing by 5. One fifth of 40 is 40 ÷ 5." The counters are what the story says (stickers, marbles, buttons), never generic dots.

**Read.** "A set has 40 stickers. 2/5 of the stickers are red. How many are red?" "2/5 of" and "red" go gold. At a glance: 2/5 is less than half, so fewer than 20 are red; the answer is a count of stickers, not a fraction.

**The example.** (1) Forty stickers in a block of four rows of ten, counted label 40. (2) "The bottom says five equal groups": five rings; stickers slide round the rings one at a time until each holds eight; a label on each ring reads 8. "One fifth of 40 is 8." Board: 40 ÷ 5 = 8. (3) "The top says take two": two rings turn teal (red), the count label reads 16. Board: 2 × 8 = 16. (4) 16 stickers are red. Board: 2/5 of 40 = 16.

Quick case, the rest: "A set has 16 counters. 1/4 are red and the rest are blue. How many are blue?" Four rings of four; one lights red; "the rest" goes gold and the other three rings light blue: 12. "The rest is the groups you did not take." Three beats.

Quick case, a known share: "1/6 of the stickers in a box is 8. How many make 3/6?" One ring of eight is a sixth; three sixths is three rings: 8, 16, 24. "Three copies of one sixth." Three beats.

**Fast.** Divide by the bottom (one group), multiply by the top (that many groups). For the rest: multiply by bottom minus top. Always works.
**Sense.** Two fifths is under half, and 16 is under 20; the rest is more than the part when the fraction is under half.
**Check.** Red plus the rest is the whole set: 16 + 24 = 40; two groups of eight are sixteen.
**Line.** "Cut the set into bottom-many groups. Take top-many."
**Trap.** Dividing by the top (40 ÷ 2 = 20) or stopping at one group (8); and for "the rest", answering the red count. The rings make the bottom the number of groups and the top the number lit; the gold word "rest" lights the other rings.
**Kit.** `group` (rings, counters dealt round one at a time, per-ring labels), `highlight` on a range of rings, `@n` counting the lit counters, counters that draw as the story's objects. `group` is in the family's build list; object counters connect the model to familiar things in early grades.
**Writer.** Strongest writer: this film defines the groups picture for the family, and the pacing of the deal is the lesson.
