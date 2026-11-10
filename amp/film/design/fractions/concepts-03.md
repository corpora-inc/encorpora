# Fractions, part 3: equivalence, comparison, benchmarks

Ten problem types across `fraction-equivalence`, `fraction-comparison` and the one benchmark type filed under `like-fraction-addition`. Written from the family design; every example uses in-grade pieces (grade 4: 2, 3, 4, 5, 6, 8, 10, 12, 100) unless the type's only variant does not.

## Findings before the concepts

- **`compare-fractions`** is `compare-like-denominators` again (same bottom), its stated method ("multiply the two denominators") is wrong for its own problems, and it uses ninths. Merge.
- **`fraction-benchmark-reasonable`** is 5.NF.A.2 ("use benchmark fractions ... to estimate mentally and assess the reasonableness of answers"), filed in grade 4 under like-fraction addition. One grade-5 skill with `benchmark-fraction-estimate`.
- **`compare-fractions-reason-blanks` does present different wholes.** The family design's section 6 says no fractions problem does; that is wrong for this type, which is the only place the "same whole" clause of 3.NF.A.3d and 4.NF.A.2 is tested. But its method text says "if the two wholes are different sizes, you cannot tell": true for 4/5 of a fun-size bar against 2/3 of a king-size, false for 3/5 of the large sandwich against 2/5 of the small (a bigger share of a bigger whole is certainly more). The brief shows no choice text; the writer must check `facts.ts`, and if the generator marks the decidable cases "cannot tell", that is a generator fix before the lesson.
- **`equivalent-fractions-select`**'s method falls back to "multiply across". Not taught in this family (it is the common denominator *bd* with the bottoms left unwritten). The common factor always decides here.
- **`compare-fractions-symbol-blanks`** shows only answer keys, no pairs. The writer takes the real pairs from `facts.ts`; the example below is a stand-in in the right cases.

## The shared opening for this part

Twenty seconds, live: a bar, bracket **1 whole**; cut into *b*, "each piece is one *b*-th; the bottom says how many make the whole"; shade *a*, "the top counts". Then, for every equivalence and comparison lesson, two more sentences drawn as they are said: **equivalent** means the same amount of the same whole, the same length, the same point; and the **re-cut**: each piece cut into *n*, the shading does not move, *n* times as many pieces each 1/*n* as big. The comparison lessons add: two bars of the **same whole** are the same width and share their left edge, and the half mark sits at the bottom's half.

---

### `fraction-equivalence-choice` — Which fraction names the same amount

**Standard**: 4.NF.A.1, "Use this principle to recognize ... equivalent fractions," with the clause the picture must show: "how the number and size of the parts differ even though the two fractions themselves are the same size."
**Foundations first**: the shared opening with *b* = 4, *a* = 1, and the re-cut done on this very bar: each fourth cut in two, the count label rewrites 1 → 2, the piece label 1/4 → 1/8, the fraction under the bar 1/4 → 2/8. "Twice as many pieces, each half as big. Same amount." Then the numbers: 1 × 2 over 4 × 2.
**Read**: "names the same amount" (gold). At a glance: 1/4 is below one half (1 is less than half of 4), so a choice at or above a half is gone; and both numbers of a right choice were multiplied by one number.
**The example**: "Which fraction names the same amount as 1/4?" choices 2/5, 2/8, 1/8, 2/4. (1) Bar in fourths, one shaded, 1/4 under it. (2) An aligned bar beneath, cut into eighths; a gold marker drops at the end of the 1/4 shading. (3) Shade to the marker: one, two. 2/8 written under; beside it 1 × 2 over 4 × 2. (4) 2/8.
**Fast**: find the number that turns the given bottom into the choice's bottom; multiply the top by it. No whole number: out. Dividing both by one number (merging pieces) is the same move backward.
**Sense**: 2/8 is still below a half, like 1/4.
**Check**: the shaded ends line up; 2 ÷ 2 over 8 ÷ 2 is 1/4 again.
**Rule out**: 2/4 is a half: dims first ("1/4 is less than a half"). 2/5 and 1/8 dim together: "not the same number on top and bottom" (one added 1 to each; the other cut the pieces without counting them). The decoys are the misconceptions; name them.
**Line**: "Same amount, smaller pieces: times the same number on top and bottom."
**Trap**: 2/5, adding one to each number (misconception 6). An aligned fifths bar shows 2/5 ending past the marker.
**Kit**: `recut` with label, count and fraction rewriting; `align`; `compare`; `dim`. Nothing new.
**Writer**: a capable cheaper model, once `equivalent-numerator` has set the re-cut; one method, one component.

---

### `equivalent-fractions-number-line` — Three names for one point

**Standard**: 4.NF.A.1 ("recognize ... equivalent fractions"); 3.NF.A.3a ("the same point on a number line"); 3.NF.A.2b for reading *P* ("marking off *a* lengths 1/*b* from 0").
**Foundations first**: the opening, then the line as the bar's bottom edge: 0 at the left, 1 at the right, a tick under every cut, heavier ticks at wholes, steps counted on arcs. "Equivalent: the same point." Then **refine**: a second, finer tick row under the first, each step cut in two; the dot has not moved; its new name has twice the top and twice the bottom. A third row: three names, one place.
**Read**: "each whole is split into *b* steps" names the piece; "which fractions name *P*? Choose 3": three names for one place. At a glance: count *P*'s steps from 0 to get *a*/*b*; any choice on a whole number *P* does not sit on is gone; any choice on the other side of 1 is gone.
**The example** (the past-one variant, because its decoy 3/4 is the tick-counting trap): line 0 to 2, each whole in 2 steps, *P* at the third tick; choices 15/10, 3/3, 4/2, 3/2, 6/4, 3/4. (1) The whole: 0 to 1, two steps, the arc reads 1/2. (2) Count from 0: one half, two halves is 1, three halves: *P* = 3/2, one whole and a half. (3) Refine by 2: fourths under; *P* is on the sixth fourth: 6/4; 3 × 2 over 2 × 2. (4) Refine by 5: tenths; fifteen: 15/10. (5) Select 3/2, 6/4, 15/10.
Quick second case (a name whose pieces cannot be drawn): *P* at 4/5, choice 80/100: 5 → 100 is × 20, 4 × 20 = 80; the numbers carry it, and hundredths are the grid from place value.
**Fast**: read *a*/*b* by counting steps; for each choice, the factor from *b* to its bottom, the same factor on top.
**Sense**: every right name is between 1 and 2 here: top between one and two times the bottom.
**Check**: each chosen fraction divides back to 3/2.
**Rule out**: 3/3 and 4/2 sit on 1 and 2, whole numbers *P* is not on: dim together. 3/4 is below 1 and *P* is past it: dims. (In the 4/5 variant, 5/5 is 1, 4/10 and 4/6 changed one number only.)
**Line**: "Steps, not ticks. Same point, three names."
**Trap**: 3/4, counting *P* as three ticks of four on a line taken as one whole (misconception 3). Made impossible by marking 1 first and counting "one half, two halves is one, three halves."
**Kit**: `numberline` fractions as specified: several wholes, heavy whole ticks, `refine` rows with the point renamed, step arcs; `dim`. Nothing new.
**Writer**: strongest. It is the first lesson that renames a point on the line; the three refinement rows must be staged on the counting words, not described.

---

### `equivalent-fractions-select` — Select the equivalent fractions

**Standard**: 4.NF.A.1, "recognize ... equivalent fractions."
**Foundations first**: the opening with 7/10 (ten pieces, seven shaded; "the tenths bar of place value", one line), equivalent defined, the re-cut into twentieths done live: 14 of 20.
**Read**: "Select the 2 ... equivalent" (gold): exactly two. At a glance: 7/10 is above half (7 > 5) and below 1 (7 < 10). 10/7 and 14/10 are above 1: gone. 7/30 is far below half (7 < 15): gone. Two remain, which is the answer before any work; now prove them.
**The example**: 7/10; choices 7/30, 10/7, 14/10, 21/30, 14/20. (1) Bar in tenths, seven shaded, gold marker at the end. (2) Aligned bar in twentieths: each tenth in two; shade to the marker: 14; 7 × 2 over 10 × 2. (3) Aligned bar in thirtieths (first piece labeled 1/30 only; the count label does the counting): 21; 7 × 3 over 10 × 3. (4) Select 21/30 and 14/20.
**Fast**: the factor from bottom to bottom, the same factor on top; a bottom with no whole-number factor (7) is out.
**Sense**: both chosen are above half and below 1, like 7/10.
**Check**: 14 ÷ 2 over 20 ÷ 2, 21 ÷ 3 over 30 ÷ 3; count two selected.
**Rule out**: as in Read, one beat, two reasons. Then name what each decoy did: 10/7 flipped; 14/10 doubled the top only; 7/30 tripled the bottom only.
**Line**: "Same amount, smaller pieces: times the same number on top and bottom."
**Trap**: changing one number only (14/10, 7/30). On the aligned bars 14 tenths needs more than the whole and 7 thirtieths is seven slivers.
**Kit**: `recut` to 30 with `labels: "first"` and the count label carrying the number. Nothing new.
**Writer**: a capable cheaper model.

---

### `compare-fractions` — Same bottom, which is larger

Badly conceived first (see findings): a same-denominator type with an unlike-denominator method, filed in grade 4 with ninths, duplicating `compare-like-denominators`. Until merged, a short lesson on the type's own numbers.
**Standard**: 3.NF.A.3d, "Compare two fractions with the same ... denominator by reasoning about their size."
**Foundations first**: the opening with ninths; "same bottom means same-size pieces."
**Read**: "larger" (gold); the answer is one of the two numbers given. At a glance: same bottom, so count.
**The example**: 3/9 or 4/9. (1) Bar in ninths, three shaded; aligned bar, four shaded. (2) Markers at both ends: 4/9 reaches one piece further. (3) 4/9.
**Fast**: same bottom: bigger top.
**Sense**: one more piece of the same size.
**Check**: the gap drawn is exactly one ninth.
**Line**: "Same piece: more pieces is more."
**Trap**: none worth naming.
**Kit**: nothing new.
**Writer**: a capable cheaper model.

---

### `compare-unlike-fractions` — Different tops and bottoms (the anchor, redone on the bar)

**Standard**: 4.NF.A.2, "Compare two fractions with different numerators and different denominators, e.g., by creating common denominators or numerators, or by comparing to a benchmark fraction such as 1/2. Recognize that comparisons are valid only when the two fractions refer to the same whole."
**Foundations first**: the opening; "of the same whole" shown as two bars of one width on one left edge; the half mark; the re-cut in one beat (taught in equivalence); and the fence on the benchmark, said aloud: the half decides only when one fraction is above it and the other below.
**Read**: "greater" or "less" (gold). At a glance: the half test, top against half the bottom. Opposite sides: done. Same side: make the pieces the same size.
**The example**: "Which is greater: 4/6 or 5/12 of the same whole?" chosen because 5 > 4 and 12 > 6 both point the wrong way. (1) Aligned bars, sixths with 4 shaded, twelfths with 5. (2) Glance: half of 6 is 3, and 4 is more: above half. Half of 12 is 6, and 5 is less: below. 4/6 is greater before any cut. (3) Prove with one piece size: 12 is two sixes, so cut each sixth in two: 8/12; the shading does not move. Eight twelfths against five; markers; the gap is three twelfths. (4) 4/6.
**Second example**, fully worked, because the glance fails and neither bottom fits into the other, the case tests love: 2/3 or 3/4. Both above half. The product of the bottoms, 12: each third in four → 8/12; each fourth in three → 9/12. 9 > 8: 3/4, by one twelfth, a sliver the markers show.
**Fast**: half test; if it does not decide, re-cut to a common piece; the product of the bottoms always works, and the bigger bottom alone works when the smaller divides it.
**Sense**: in the second example both are near 1; 2/3 is a third short, 3/4 a fourth short, and a third is bigger than a fourth, so 3/4 is nearer 1.
**Check**: both over 12, compare tops; the gap is a count of twelfths.
**Line**: "Make the pieces the same size, then count."
**Trap**: comparing tops (5 > 4) or bottoms (12 > 6). The aligned bars show five twelfths shorter than four sixths; "more pieces, smaller pieces" is said on the cut.
**Kit**: `align`, `recut`, `compare`, a half mark (`marks` at 0.5). Nothing new.
**Writer**: strongest. It is the family's reference lesson, it fences the benchmark, and the second example is choreography.

---

### `fraction-choice-compare` — Which choice is greater (or less) than a stated number

A mixed type in three kinds: against a whole number (greater than 1; less than 2), against a fraction (greater than 5/8; less than 1/5), and the greatest of four mixed numbers with the same whole. The lesson teaches reading: find the fence, find the side.
**Standard**: 4.NF.A.2 (common denominators, benchmark); 3.NF.A.3c, "Express whole numbers as fractions" (1 is 5/5, 2 is 16/8).
**Foundations first**: the opening on a chain of two wholes; "a whole number is a fraction too: as many pieces as make the wholes: 1 is five fifths, 2 is sixteen eighths"; the half test.
**Read**: the fence and the direction go gold. One beat on what the answer must look like: "greater than 1" means top bigger than bottom; "less than 2" means top less than twice the bottom; "greater than 5/8", which is above half, means the answer is at least above half.
**The example** (the fraction fence, because it needs both the glance and the common piece): "Which is greater than 5/8?" choices 11/12, 2/5, 1/3, 2/7. (1) Bar in eighths, five shaded, half mark: above half. (2) 2/5, 1/3, 2/7: each top below half its bottom (2 < 2½, 1 < 1½, 2 < 3½): below half, below 5/8; dim together. (3) 11/12: one twelfth short of 1, while 5/8 is three eighths short; aligned bars show it. Prove on twenty-fourths: 15/24 against 22/24. (4) 11/12.
Quick cases, each a different reading: greater than 1 (2/5, 4/5, 2/3, 7/5): three tops smaller than their bottoms dim together; 7/5 is five fifths and two more, past 1 on the chain. Less than 2 (7/3, 13/8, 11/4, 19/8): 2 is 16/8, and 13 < 16; the others pass 6/3, 8/4, 16/8. The plants, 5 1/3, 5 1/12, 5 5/6, 5 3/4: the wholes tie, so only the fraction parts matter, on four aligned bars of the sixth inch; 1/12 and 1/3 are below half: dim; 5/6 and 3/4 in twelfths: 10 against 9: 5 5/6.
**Fast**: whole-number fence: top against fence times bottom. Fraction fence: half test, then common pieces. Mixed numbers with equal wholes: compare the fraction parts only.
**Sense**: the chosen one sits on the asked side of the fence on the line.
**Check**: fence and choice over one bottom; compare tops.
**Rule out**: as above; one beat per kind.
**Line**: "A whole is as many pieces as make it: 1 is five fifths."
**Trap**: 5 1/12 as the tallest because 12 is the biggest number (misconception 4): the aligned fraction parts show 1/12 as the thinnest sliver. For "greater than 1", 4/5 "because it is almost one": four fifths does not reach the whole boundary.
**Kit**: `wholes` chain, four aligned bars, `dim`. Nothing new.
**Writer**: strongest. Mixed; the quality is in one example per kind and the glance that empties the choices.

---

### `compare-fractions-symbol-blanks` — Record two comparisons with <, =, >

**Standard**: 4.NF.A.2, "Record the results of comparisons with symbols >, =, or <." Six wordings, one method; the story wordings name the whole (a mile, a cup, an hour) on the bracket. Read the actual pairs from `film/facts.ts` before writing.
**Foundations first**: the opening; two bars of the same whole; the sign built from the bars: drawn between the two shaded ends, small end at the shorter shading, open end at the longer, and the two bars meeting end to end are "=". Same handoff as place value: "small end to the small number."
**Read**: two pairs, each its own question; the order is fixed and only the sign is asked. At a glance: same bottom, count; same top, the smaller bottom wins; else the half test, then common pieces. "=" only when one re-cuts exactly onto the other.
**The example** (stand-in pairs in the two cases the keys show): 3/4 ? 5/8 and 2/6 ? 1/3, of a mile. Pair 1: aligned bars "1 mile"; 3/4 re-cut to 6/8; 6 against 5; the sign drawn small end at 5/8: 3/4 > 5/8. Pair 2: 1/3 re-cut into sixths: 2/6; the shaded ends meet: 2/6 = 1/3. Read each as a sentence.
**Fast**: same bottom, same top, half test, common pieces, in that order; "=" means the same point.
**Sense**: 3/4 is a fourth short of 1, 5/8 is three eighths short; the bigger gap is the smaller fraction.
**Check**: read the finished sentence aloud, "three fourths is greater than five eighths," and ask if it is true.
**Line**: "Small end to the small fraction. Equal only when they are the same point."
**Trap**: 2/3 = 3/4 "because both are one piece short" (misconception 6): the gaps are a third and a fourth, different sizes, shown on aligned bars. And the right order with the sign pointing the wrong way: the sign is built from the bars.
**Kit**: a comparison sign drawn between two aligned bars, small end to the shorter shading (a small figure element). Otherwise nothing new.
**Writer**: a capable cheaper model, once `compare-unlike-fractions` exists.

---

### `order-fractions-slots` — Three fractions in order

Judged 3.NF.A.3 but filed in grade 4; the two visible variants are same-bottom. The goal's third kind (ordering by one half) is only sound when the three fall in three different bands; the generator must guarantee that, or the lesson's method for that kind is common pieces with the half as a first look.
**Standard**: 3.NF.A.3d, "Compare two fractions with the same numerator or the same denominator by reasoning about their size," extended to three.
**Foundations first**: the opening in twelfths; "order" means placing them on one line, least at the left; the direction word is the whole question and goes gold.
**Read**: "least to greatest" or "greatest to least" (gold); the answer is the three given numbers rearranged. At a glance: same bottom, the tops already order them; the first slot takes the smallest (or the largest).
**The example**: 8/12, 4/12, 10/12, least to greatest. (1) Three aligned bars in twelfths, shaded 8, 4, 10, counts ticking. (2) Markers: 4 ends first, then 8, then 10. (3) Slots fill left to right: 4/12, 8/12, 10/12. (4) The direction beat: had it asked greatest to least, the same three reversed.
Quick second case (same top, the other reasoning): 2/3, 2/8, 2/5 greatest to least. "Two pieces each; more pieces in the whole, smaller pieces": 2/3, 2/5, 2/8, the aligned bars showing thirds longest.
**Fast**: same bottom, order the tops; same top, order the bottoms backward; otherwise common pieces.
**Sense**: the markers run left to right in the order read.
**Check**: each neighboring pair read as a true comparison; the direction matches the question.
**Line**: "Same piece: count. Same count: the smaller bottom has the bigger piece."
**Trap**: the direction reversed, and, with same tops, 2/8 placed greatest because 8 is biggest. The gold direction word stays on screen; the aligned bars.
**Kit**: three aligned bars; the slot card on the board. Nothing new.
**Writer**: a capable cheaper model.

---

### `compare-fractions-reason-blanks` — Which is bigger, and why

See findings: this type does present different wholes, and the app's "cannot tell" must be checked against the decidable cases. Sevenths are off grade; the stories give in-grade pieces.
**Standard**: 3.NF.A.3d, "Compare two fractions with the same numerator or the same denominator by reasoning about their size. Recognize that comparisons are valid only when the two fractions refer to the same whole ... justify the conclusions," and the same-whole clause of 4.NF.A.2.
**Foundations first**: the opening; "same whole" as two bars of one width; "more pieces, smaller pieces" said on a cut. Then, the one place in the family where two wholes of different widths are drawn, with the reason said aloud.
**Read**: three questions in order: same whole? same bottom or same top? which is bigger, and is the reason about the number of pieces or the size of the pieces? For different wholes: do the share and the whole point the same way?
**The example** (same whole, same top): Student G practiced 1/6 of an hour, Student H 1/2. (1) Two bars bracketed "1 hour", aligned; one cut into sixths, one into halves; one piece shaded in each. (2) Same count of pieces, one each; a half is three sixths: the bigger piece. (3) Student H; "because halves are bigger pieces than sixths."
**Second example**, fully worked, because it is the case only this type practices: 4/5 of the fun-size bar against 2/3 of the king-size. (1) A short bar, fifths, four shaded; below it a wider bar, thirds, two shaded. (2) The king bar stretches while its 2/3 keeps its share: a little wider, and 2/3 of it still ends before 4/5 of the fun size; twice as wide, and it ends well past. (3) "Different wholes: the fractions alone cannot tell." Quick beat on the decidable kind: 2/5 of the small sandwich against 3/5 of the large: a bigger share of a bigger whole wins however the large grows.
**Fast**: same bottom: count tops; same top: the smaller bottom wins; different wholes: the bigger share of the bigger whole wins, otherwise cannot tell.
**Sense**: the aligned bars.
**Check**: read the finished sentence aloud and ask if the reason is true of the picture.
**Rule out**: a reason about the number of pieces when the counts are equal (or about piece size when the pieces match) dims with that one word said.
**Line**: "Same whole first. Same count: the smaller bottom has the bigger piece."
**Trap**: 1/6 as more because 6 is more (misconception 4): the cut shows sixths as slivers; and comparing fractions of different wholes as if the same (misconception 14): the stretching bar.
**Kit**: `align` must take a deliberate different width (`"whole": 1.6` of the first), and a stretch of a bar's whole with the shaded fraction keeping its share (`scale` nearly does this; the live stretch is new). The slot card with sentence pills.
**Writer**: strongest. The different-wholes motion is the design, and the type is reasoning in words.

---

### `fraction-benchmark-reasonable` — Landmarks: nearest, estimate, judge

Misfiled (see findings): 5.NF.A.2 in a grade-4 skill, twin of grade 5's `benchmark-fraction-estimate`; put both in one grade-5 skill. A mixed type with four kinds (nearest benchmark; estimate a sum; estimate a difference; judge a given answer), all on one picture.
**Standard**: 5.NF.A.2, "Use benchmark fractions and number sense of fractions to estimate mentally and assess the reasonableness of answers. For example, recognize an incorrect result 2/5 + 1/2 = 3/7, by observing that 3/7 < 1/2."
**Foundations first**: the opening; define **benchmark**: "a number you know well, used as a landmark." The line 0 to 1 with 1/2 at half the bottom, 1/4 and 3/4 at half of each half, labeled under the fraction's own ticks. How to find the side of 1/2: top against half the bottom. "Near 0 or 1" means within a piece of the end.
**Read**: "closest to" asks for one of five; "estimate" asks for the sum or difference of the landmarks, not the exact answer, and it will be near but not equal; "reasonable" asks whether a given answer is near the estimate. At a glance: the half test puts each fraction on a side.
**The example** (nearest): 2/5; choices 1/4, 3/4, 1/2, 0. (1) Bar in fifths, two shaded; the benchmark row under it. (2) Half of 5 is 2½; 2 is just under: just below one half. (3) The dot drops a sliver left of 1/2 and far from 1/4; both gaps drawn. (4) 1/2.
**Second example**, fully worked, because judging a given answer is a different act: a student adds 11/12 + 6/12 and gets 17/24. (1) 6/12 is exactly 1/2; 11/12 is a piece short of 1. Landmarks: 1 + 1/2, about 1½. (2) On the line, join six twelfths to eleven: past 1. (3) 17/24 is less than 1 (17 < 24): impossible. The error: bottoms added; joining pieces never changes the piece. (4) The true statement: each is at least 1/2, so the sum is at least 1, but 17/24 is less than 1.
Quick cases: 4/5 − 3/5: 4/5 is a sliver past 3/4 and a whole fifth from 1, so 3/4; 3/5 is just over half, so 1/2; 3/4 − 1/2: about 1/4 (exact 1/5, close). 4/6 + 2/6: 3/4 + 1/4: about 1 (exact 6/6, exactly 1).
**Fast**: half the bottom gives the side of 1/2; within a piece of an end means 0 or 1; the quarters by the line. Add or subtract landmarks. Compare the exact or given answer with the estimate.
**Sense**: two fractions under 1 sum to under 2 and differ by under 1; a benchmark estimate is at most a quarter from the truth.
**Check**: the exact answer lands within about a quarter of the estimate; farther means a mistake.
**Rule out**: nearest: landmarks on the other side of 1/2 dim at once. Estimates: a difference "about 1 1/4" or more, a sum "about 2 1/2" or more, dim. Statements: "the sum is always less than 1" (two halves make 1), "adding doubles the denominator" (that is the error itself), "each is less than 1/2" (11/12 is not) dim together.
**Line**: "Replace each fraction with its landmark, then add. If each is at least a half, the sum is at least one."
**Trap**: 2/5 near 1/4 because 2 is small (misconception 15): half the bottom is 2½. Accepting 17/24 (misconception 5): the join on the line passes 1.
**Kit**: `numberline` gains a benchmark row (0, 1/4, 1/2, 3/4, 1 labeled under the fraction's ticks) and a `snap` (the dot slides to the nearest landmark with both gaps drawn); `join` on the line. The benchmark row and snap are new.
**Writer**: strongest. Mixed, and the reasonableness statements are reasoning the kit cannot check.
