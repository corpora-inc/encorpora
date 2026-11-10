# Probability and counting, part 1: ten concepts (grade 7)

Each concept stands on the family design and says which foundations it uses. The habits (Read, At a glance, the sure fast way, Sense, Check) run in every film in the order the design gives; here they are filled in for the type.

---

## `simple-probability` — One color from a bag

**Standard.** 7.SP.C.7a: "Develop a uniform probability model by assigning equal probability to all outcomes, and use the model to determine probabilities of events." With 7.SP.C.5's first sentence, "the probability of a chance event is a number between 0 and 1", because the chance line is where the answer lands.

**Foundations first.** Foundations 1, 2, 3, 4. Define, in order, each on the moment it appears: an *outcome* is one thing that can happen (one counter comes out); *equally likely* means each counter has the same chance (the bag is shaken, nobody peeks); the *probability* of an event is its share of all the outcomes. Build the strip: the bag drawn with its 4 rust and 8 teal counters; the counters line up one at a time into a row of twelve equal cells, like colors together, the count ticking 1 to 12; the chance line appears under the strip, 0 at its left end, 1 at its right, with the words impossible, unlikely, as likely as not, likely, certain. "The strip is everything that could happen. Its whole length is 1."

**Read.** "A bag contains 4 red counters and 8 blue counters. Each counter is equally likely to be drawn. What is the probability of drawing a red counter in one draw?" Gold on *red* (what counts as success) and on *bag* (everything is the whole bag). The answer is a fraction between 0 and 1. At a glance: red is fewer than half the counters, so the answer is less than 1/2.

**The example.** 4 red, 8 blue (the fraction that must be simplified, and the bag where "4 out of 8" tempts). (1) The strip of 12 stands with its twelve counters. (2) The four red cells shade; the count reads 4. (3) The fraction writes: shaded over all, 4 over 12; the 12 is written under the line as the strip's full length is bracketed. (4) The four red cells slide together to the left end. (5) The strip's cuts regroup into three equal parts of four cells; the red run is exactly one of the three: 4/12 = 1/3. (6) The dot drops from the end of the red run onto the chance line at 1/3, in the "unlikely" band, well right of 0. Quick beat, same bag: blue is the rest, 8 of 12 = 2/3; red and blue fill the strip, 1/3 + 2/3 = 1.

**Fast.** Count what you want. Count everything. Write want over everything. Simplify.

**Sense.** 4 is less than half of 12, so the dot sits left of the middle; 1/3 does.

**Check.** Shaded 4 plus unshaded 8 is 12, the whole strip. Red and blue together make 1.

**Line.** "Count what you want. Count everything. Divide."

**Trap.** 4/8: red compared with blue instead of with the bag. The 12 is written under the fraction while the whole strip is bracketed; a fraction over 8 would need a strip four cells shorter. Also 4/12 left unsimplified; the regroup into thirds shows 1/3 as the same length.

**Kit.** `strip`, `bag`, `lineup`, `pick`, `sort`, `drop`, the chance line with word bands (4.1, 4.2); a regroup of the strip's cuts into d equal parts for simplifying (the existing `bar` partition, applied to a strip with its cells kept).

**Writer.** Cheaper model: one picture, one count, the concept names every beat.

---

## `staar-experiment-probability` — A table of results; two draws with replacement

**Flag first.** Two unrelated kinds under one name, as the family design says: an experimental probability read from a table of results, and the probability of two draws with replacement. Split them. Until then the lesson is mixed and teaches reading: the word *table* means "count what was seen"; the words *put back* mean "the second draw sees the same cards".

**Standard.** Kind A: 7.SP.C.6, "Approximate the probability of a chance event by collecting data on the chance process that produces it and observing its long-run relative frequency", and 7.SP.C.7b, "Develop a probability model (which may not be uniform) by observing frequencies in data generated from a chance process." Kind B: 7.SP.C.8a, "the probability of a compound event is the fraction of outcomes in the sample space for which the compound event occurs", and 8b (tables).

**Foundations first.** Kind A (foundation 5): a *trial* is one draw, recorded, put back; the table's bottom row is the trials; the *experimental probability* is times it happened over trials. The table is built as the trials fall into it. One tile per trial, so a trial can be blue or yellow, never both: "or" adds the two columns. Kind B (foundations 6 and 10): the twelve cards as a strip; *put back* means the second strip is the same twelve; an outcome is a pair, first draw by second draw, so pairs make a 12 by 12 grid of 144 equally likely cells.

**Example A.** "A bag has tiles of four colors. A tile is drawn, its color is recorded and it is put back, 60 times. The table shows the results." Table: red 14, blue 12, green 18, yellow 16. "What is the experimental probability of drawing a blue tile or a yellow tile?" Gold on *or* and *60 times*. (1) The blue and yellow columns light; 12 + 16 = 28. (2) The whole is the trials, 60, written under the line. (3) 28/60 = 7/15. Sense: fewer than half the draws. Check: 14 + 12 + 18 + 16 = 60; the other two colors are 32/60, and 28 + 32 = 60.

**Example B.** "A box holds 12 cards. 9 of the cards are red and 8 of the cards are labeled 0. A card is drawn at random and put back. Then a second card is drawn. What is the probability that the first card is red and the second card is labeled 0?" Gold on *put back* and *and*. (1) Strip of 12; nine red cells shade: first draw, 9/12. (2) The card slides back in; the strip is whole again; eight cells labeled 0 shade rust: second draw, 8/12. (3) The grid: rows are the first draw, columns the second; the red rows and the 0 columns fill; the overlap, a 9 by 8 rectangle of violet cells, is "red then 0": 72 of 144. (4) 72/144 = 1/2; the same number as 9/12 × 8/12 = 3/4 × 2/3, three quarters of the rows by two thirds of the columns is half the grid. Sense: less than either 9/12 or 8/12. Check: 9 × 8 = 72, and 144 − 72 = 72 cells unshaded.

**Fast.** A: add the columns named, over the trials. B: multiply the two fractions, both over the full set.

**Line.** "Or adds columns of one table. And in sequence multiplies along the path."

**Trap.** A: dividing by the number of colors (2/4) or by the number of tiles in the bag; the whole is the 60 under the table. B: adding 9/12 + 8/12 (more than 1, nonsense on the chance line), or writing the second denominator as 11 as if the card were kept; the card is seen sliding back and the second strip is the same twelve.

**Kit.** `table` of results with column highlights (exists); `strip` and a *put back* motion (a picked cell returns); `table` fills with violet overlap and a live count (4.3).

**Writer.** Strongest: a mixed type that must be read, with two pictures and a decision about which one.

---

## `experimental-probability-predict` — What trials show, and what they predict

**Standard.** 7.SP.C.6 in full: "Approximate the probability of a chance event by collecting data on the chance process that produces it and observing its long-run relative frequency, and predict the approximate relative frequency given the probability. For example, when rolling a number cube 600 times, predict that a 3 or 6 would be rolled roughly 200 times, but probably not exactly 200 times." And 7.SP.C.7, "Compare probabilities from a model to observed frequencies."

**Foundations first.** Foundation 5 whole, slowly. A paper cup tossed 25 times; the results fall one at a time into a two-column chart (side, not side); a label counts "k of n"; beside it, the running share is traced against the number of tosses: wild for the first ten, then settling. Define *experimental probability*: the share seen, times it happened over trials. Say the two facts the standard says: it predicts a share, not an exact count; more trials, closer. The theoretical probability, when there is one (a fair cube), is the dashed line the trace hugs.

**Read.** Four kinds under one name; the gold word tells which. "experimental probability ... enter a decimal": the share seen. "predict how many times in 400": the share seen times the new trials. "how many more than the theory predicts": theory's count, then the difference. "whose result is the better basis": the one with more trials. At a glance: a prediction is never more than the trials; a predicted count for theory is probability × n; the two fractions in Student J's problem are equal.

**The example.** "A thumbtack was dropped 50 times and landed point up 16 times. Use these results to predict how many times the thumbtack lands point up in 400 drops." (1) 16 of 50 shade on a strip of 50; the share is 16/50 = 8/25 = 0.32, a hair below a third; no theory exists for a tack, so the trials are all we have. (2) A bar of 400 drops with the double scale, share above, count below; shade to 0.32; the count reads 128. (3) The other way, as the app does it: 400 is 8 times 50, so 8 times 16 = 128. (4) "About 128, probably not exactly." Quick beat (the decimal kind): 4 of 25 is 16 of 100, so 0.16.

**Second example, a different case: observed against theory.** "A fair number cube is rolled 90 times and a 6 comes up 20 times. The theoretical probability of a 6 is 1/6. How many more 6s came up than the theory predicts?" The bar of 90 shaded 1/6 reads 15: theory's count. The observed 20 is marked beside it. 20 − 15 = 5. The run of 90 shows the trace near, not on, the dashed 1/6.

**Third example, multiple choice: whose result.** Student J 4 of 12, Student C 40 of 120, predicting 500. Two traces on one chart: both end at 1/3; Student J's stops at 12 while it is still swinging; Student C's has settled. Student C's. Rule out: "equally reliable" ignores the trial count; "easier to count correctly" is not about chance; "4/12 is the greater fraction" is false, 4/12 = 40/120.

**Fast.** Share = happened ÷ trials. Prediction = share × new trials (or scale the count by the trials' factor). Theory's count = probability × trials; compare by subtracting.

**Sense.** A prediction is less than the trials; 128 of 400 is the same share as 16 of 50; theory's 15 is one sixth of 90.

**Check.** 128/400 = 0.32; 15/90 = 1/6; a difference of 5 is small against 90, as the trace shows.

**Line.** "Probability predicts the share, not the exact count. More trials, closer."

**Trap.** Expecting exactly 15 sixes, so the question "how many more" seems a trick; the trace shows 20 as ordinary. Multiplying count by trials (16 × 400 = 6,400 landings in 400 drops): the prediction cannot exceed the trials, and the bar of 400 cannot be shaded past its end.

**Kit.** `trials` and `runshare` (4.8), the `bar` double scale (exists), the strip.

**Writer.** Strongest: four kinds, and the lesson is the foundation; the decoys are beliefs.

---

## `probability-missing-count` — The count from the probability

**Flag first.** The generator produces one wording (3 blue, P(red) = 3/4). The app's method solves x/(x + 3) = 3/4 by clearing fractions. A grade 7 child can, but the sure way to *see* it needs no letter: the blue counters are the unshaded part of the strip, and that tells the size of one part. The lesson teaches the picture as the method and shows the equation once, as the same fact in symbols, so the app's working is recognized.

**Standard.** 7.SP.C.7a, "Develop a uniform probability model ... and use the model to determine probabilities of events", run backward: the model's share is given and the count is asked.

**Foundations first.** Foundations 2 and 4. The strip is the whole bag, length 1. A probability of 3/4 for red means the strip cut into four equal parts has three parts red. Blue is the rest: one part. Every part holds the same number of counters, because the counters are equally likely.

**Read.** "A bag contains only red and blue counters. It contains 3 blue counters. One counter is selected uniformly at random. The probability that it is red is 3/4. How many red counters are in the bag?" Gold on *3 blue* and *3/4*. The answer is a whole number of counters, more than 3 (red is more likely than blue). At a glance: blue is 1/4 of the bag, and 3 counters make that quarter.

**The example.** (1) The strip cut into four equal parts; three shade teal for red, one stays for blue; 3/4 and 1/4 written over them. (2) The three blue counters drop into the blue part: one part holds 3 counters. (3) Three counters drop into each red part, 3, 6, 9. (4) Red is 9; the bag holds 12. (5) The equation once, beside the picture: red over red + 3 is 3/4, so 9/12.

**Fast.** 1 − P(red) is the share of the known color; known count ÷ its share is the whole; whole − known is the answer. Always works when the other count is given.

**Sense.** More red than blue, since 3/4 > 1/4; three times as many, since three parts against one.

**Check.** 9/(9 + 3) = 9/12 = 3/4.

**Line.** "The rest of the strip tells the size of one part."

**Trap.** Answering 3 or 4, the numerator or denominator read as counts; or 4 − 3 = 1 blue, which contradicts the bag's 3. The three blue counters sitting in one quarter make "one part is 3" the first thing seen.

**Kit.** `strip` with a partition into d parts and counters dealt into the parts.

**Writer.** Cheaper model.

---

## `likelihood-in-words` — Certain, likely, as likely as not, unlikely, impossible

**Standard.** 7.SP.C.5 in full: "the probability of a chance event is a number between 0 and 1 ... Larger numbers indicate greater likelihood. A probability near 0 indicates an unlikely event, a probability around 1/2 indicates an event that is neither unlikely nor likely, and a probability near 1 indicates a likely event." The app sharpens "around 1/2" to exactly half for "as likely as not"; the lesson says so.

**Foundations first.** Foundation 1, built live. The chance line from 0 to 1 with its five words, each defined as it is written: *impossible* at 0, it cannot happen; *certain* at 1, it must happen; *as likely as not* at exactly 1/2, half the outcomes; *unlikely* the stretch between 0 and 1/2; *likely* the stretch between 1/2 and 1. Then the strip above the line: the cube's six faces as six cells. "The chance is where the end of the shaded run lands."

**Read.** "A number cube has the faces 1, 2, 3, 4, 5 and 6. You roll it once. How likely is it that you roll a number greater than 1?" Choices: Unlikely, Likely, Impossible, Certain. Gold on *greater than 1*. The answer is a word. At a glance: only one face fails, so it is nearly certain but not certain.

**The example.** (1) The six cells, 1 to 6. (2) *Greater than 1*: cells 2, 3, 4, 5, 6 shade; the count reads 5; the 1 stays unshaded. (3) The run is 5 of 6; the dot drops at 5/6, in the likely band, short of 1. (4) Not certain: a 1 can come up. Likely. Quick cases, one beat each, the same strip: a spinner all yellow, 8 of 8 shaded, the run reaches the end, dot on 1, certain. Rolling a 7: no cell is a 7, nothing shades, dot on 0, impossible. 5 red of 10: the run ends exactly at the middle, as likely as not.

**Fast.** None shaded: impossible. All shaded: certain. Otherwise compare the shaded count with half the cells: more, likely; exactly half, as likely as not; fewer, unlikely.

**Sense.** The dot's band is the word.

**Check.** Count the unshaded cells: 0 means certain, all means impossible, equal to the shaded means as likely as not.

**Rule out.** If any cell fails, Certain dims; if any cell succeeds, Impossible dims. Then it is one of three, decided by half.

**Line.** "Certain is the whole strip. Impossible is none of it. Half is as likely as not."

**Trap.** "Likely" for an all-yellow spinner (it must happen, so it is certain) and "unlikely" for rolling a 7 (it cannot happen). The dot on 1 sits past the likely band; the dot on 0 sits past unlikely.

**Kit.** `strip`, `spinner` with `unroll`, the chance line with word bands.

**Writer.** Cheaper model.

---

## `probability-on-number-line` — Which point shows the chance

**Standard.** 7.SP.C.5, "the probability of a chance event is a number between 0 and 1", and 7.SP.C.7a for the share itself.

**Foundations first.** Foundations 1 and 2, with one new seeing: the chance line in the problem is cut into one space per outcome, so it is the strip's own edge. Build it: the six faces of the cube as six cells; the app's own number line drawn directly under them, 0 under the strip's left end, 1 under its right, its six spaces lining up with the six cells. "One space on the line for each outcome. A shaded cell is a space."

**Read.** "A number cube has the faces 1, 2, 3, 4, 5 and 6. You roll it once. The number line from 0 to 1 is cut into 6 equal spaces. Which point shows the chance that you roll a number less than 5?" Choices: Point A, B, C, D. Gold on *less than 5* and *6 equal spaces*. At a glance: four faces are less than 5, more than half, so the point is right of the middle.

**The example.** (1) The strip of six; *less than 5* shades 1, 2, 3, 4; the 5 stays unshaded, said aloud: five is not less than five. (2) The four shaded cells are already at the left; the run ends at the fourth cut. (3) The dot drops onto the line at that cut; four jumps from 0, each one space, counted on arcs: one, two, three, four. (4) The lettered point under it is D. Quick case, a different look: a bag of 1 orange, 4 yellow, 1 green, chance of orange; the strip lines up out of the bag; one cell shades; one jump from 0; point A.

**Fast.** Count the successes; count that many spaces from 0.

**Sense.** More than half the faces, so the point is past the middle of the line.

**Check.** Count the failures from 1 going left: two spaces back from 1 lands on the same point.

**Rule out.** Points on the wrong side of the middle dim together. For a one-success event every point past the first cut dims.

**Line.** "One space for each outcome. Count the successes from 0."

**Trap.** Counting the 5 in "less than 5" and landing one space too far; the 5 is unshaded on screen. Counting ticks instead of spaces and landing one short; only arcs are counted, as in the place-value lines.

**Kit.** `strip` aligned over the app's number-line scene (`figure: example`) so the cells sit over the spaces; `drop`; the arcs from `numberline`.

**Writer.** Cheaper model.

---

## `equal-chance-choice` — The spinner or bag that gives the chance you want

**Standard.** 7.SP.C.5, "Larger numbers indicate greater likelihood", and 7.SP.C.7a (the uniform model: equal sections, equal counters).

**Foundations first.** Foundations 2 and 3. Every choice has the same number of equal sections, so chance is compared by count alone: equal counts, equal chances; the biggest count, most likely; the smallest, least likely. Build the picture: the four choices drawn as four spinners, each unrolled into a strip of ten cells, the four strips aligned one under another with like colors sorted together, so lengths can be compared by eye.

**Read.** "Each spinner below has 10 equal sections in red, blue and orange. You spin once. You want red and blue to be equally likely. Which spinner should you use?" Choices: 5 red, 1 blue, 4 orange | 1 red, 2 blue, 7 orange | 2 red, 1 blue, 7 orange | 1 red, 1 blue, 8 orange. Gold on *red and blue* and *equally likely*. At a glance: orange does not matter; look only at the red run and the blue run of each strip.

**The example.** (1) Four strips, red runs then blue runs at the left of each, orange muted. (2) Strip by strip, the two runs are compared: 5 against 1, 1 against 2, 2 against 1: unequal; 1 against 1: equal. (3) The fourth spinner. Second example, a different question: "Each bag of marbles below has 6 marbles in red, green and purple. You want red to be less likely than each of the other colors." 3-1-2, 2-1-3, 2-2-2, 1-2-3. The red run must be shorter than *both* the others: 3 red is the longest; 2 red is longer than 1 green; 2-2-2 ties; 1-2-3 is the only one where the red run is shortest of the three. The fourth bag.

**Fast.** Read only the colors the question names; compare their counts; "less likely than each" means smaller than both.

**Sense.** Equal lengths look equal; the least-likely run is visibly the shortest.

**Check.** Count the named colors in the chosen one once more; for "less likely than each", check against each other color in turn.

**Rule out.** Any choice where the named counts are unequal dims at once with the reason "five against one". For "less likely than each", any choice where the named color ties or beats one other color dims.

**Line.** "Same sections, so compare the counts; and only the colors the question names."

**Trap.** For "less likely than each", checking against one other color only: 2 red, 1 green, 3 purple passes against purple and fails against green. The three aligned runs are compared in one look. A 0 count elsewhere (4-4-0) hides a tie; the two equal runs are side by side.

**Kit.** `spinner` and `bag` per choice with `unroll` and `lineup` into aligned strips; `dim`.

**Writer.** Cheaper model.

---

## `expected-count-blanks` — Probability of a number, and its predicted count

**Flag first.** The generated output shows only the answer keys for two blanks ("prob": "b", "count": "c"), not the sentence or the number asked; the writer must run `facts.ts` for the exact sentence and the options in each blank. The concept below assumes the asked number is 40 (four sections). "Expected count" here means the predicted count of foundation 5, not the expected value of algebra 2; the lesson uses the word *predict*.

**Standard.** 7.SP.C.6, "predict the approximate relative frequency given the probability", and 7.SP.C.7a for the model.

**Foundations first.** Foundation 3 above all: the spinner has ten equal sections but only six different numbers, and the equally likely things are the sections. Build it: the spinner with 40, 30, 40, 10, 30, 60, 50, 10, 40, 40 drawn at exactly 36 degrees each; it unrolls into a strip of ten cells, each cell wearing its number; the four 40s sit in different places. Then foundation 5 in one line: a prediction for n spins is the probability's share of n, about that many, probably not exactly.

**Read.** "A spinner has 10 equal sections with these numbers: 40, 30, 40, 10, 30, 60, 50, 10, 40, 40. It is spun 80 times. Complete the sentence." Gold on *equal sections* and *80 times*. At a glance: 40 appears on four of the ten sections, so its chance is less than half, and the count is less than 40 spins.

**The example.** (1) The four cells showing 40 shade; the count reads 4 of 10. (2) 4/10 = 2/5, the ten cells regrouped into five pairs, two of them red. (3) The bar of 80 spins with share above and count below; shade to 2/5; the count reads 32. (4) The other way, on the strip: 80 spins over 10 sections is 8 spins per section; four sections, 4 × 8 = 32. (5) "About 32, probably not exactly."

**Fast.** Count the sections with the number; over the number of sections; simplify; times the spins. Or: spins per section, times the sections with the number.

**Sense.** 2/5 is less than half; 32 is less than half of 80.

**Check.** 32/80 = 2/5.

**Line.** "The equally likely things are the pieces, not the names."

**Trap.** 1/6, counting the six different numbers instead of the ten sections; the strip has ten cells and the four 40s are shaded in four places. Writing 32 as the probability or 2/5 as the count: the sentence names which blank is a share and which a count.

**Kit.** `spinner` with number labels and `unroll`; `strip` with labeled cells; the `bar` double scale (exists).

**Writer.** Cheaper model.

---

## `counting-principle` — How many complete outcomes

**Flag first.** Linked to 6.EE.A.1 ("numerical expressions involving whole-number exponents"), which it serves only in the code variant (8⁴). It serves 7.SP.C.8b: "Represent sample spaces for compound events using methods such as organized lists, tables and tree diagrams." Fix the link.

**Standard.** 7.SP.C.8b as quoted; the count is the size of the sample space the next lessons shade.

**Foundations first.** Foundation 6. A complete outcome is a *pair*: one sandwich and one soup. Pairs make a grid: one row per sandwich, one column per soup; every row has the same number of cells because every sandwich goes with every soup. Build it: two rows, eight columns, filled row by row with the count ticking 8, 16. "Rows times columns. The grid counts for you." Then the same for three stages: a path with a number of choices at each step, written in slots.

**Read.** "A café's lunch special has one sandwich and one soup. There are 2 sandwiches and 8 soups to choose from. How many different lunch specials are possible?" Gold on *one sandwich and one soup*. The answer is a whole number, more than 8. At a glance: each of 2 sandwiches comes with 8 soups, so twice 8.

**The example.** (1) The grid, sandwiches down the side (S1, S2), soups across the top (1 to 8). (2) The first row fills, cell by cell, each cell a pair; 8. (3) The second row; 16. (4) 2 × 8 = 16.

**Second example, a different case: three stages.** "A trip goes from Ash to Dale, passing through Birch and Cedar in that order. There are 8 roads from Ash to Birch, 8 roads from Birch to Cedar and 7 roads from Cedar to Dale." Three slots, Ash–Birch, Birch–Cedar, Cedar–Dale; 8, 8, 7 drop in; 8 × 8 = 64 ways to reach Cedar, each continued 7 ways: 448. The grid would need a third direction; the slots are the same multiplication.

**Quick third case: positions with repeats.** "A code has 4 positions. Each position is one of the 8 letters A through H, and letters may repeat." Four slots, 8 in each because a letter may repeat; 8 × 8 × 8 × 8 = 8⁴ = 4,096.

**Fast.** One number per stage; multiply.

**Sense.** More than any one stage's count; 16 is two rows of 8; 448 is a bit less than 8 × 8 × 8 = 512.

**Check.** Count the grid the other way: eight columns of 2 is 16. For the trip, 8 × 7 = 56 routes from each of the 8 first roads: 8 × 56 = 448.

**Line.** "An outcome is a pair. Pairs make a grid: rows times columns."

**Trap.** Adding: 2 + 8 = 10. Ten cells is one row and two cells of the grid, nowhere near all of it. For codes, 8 × 7 × 6 × 5 as if letters could not repeat; the gold words *may repeat* keep 8 in every slot.

**Kit.** `table` filled by rows with a live count (4.3); `slots` with the product under the row (4.7).

**Writer.** Cheaper model.

---

## `compound-event-simulation` — A share of the grid; a simulation read against theory

**Flag first.** No simulation is designed or run anywhere in the type, so the name is wrong; the second kind reports a count from a simulation and asks for the comparison. Two kinds under one name: a theoretical share of a sample space, and that comparison. The multiple-choice decoys for "tails or six" (7/8, 5/12, 1/12) are only partly the real errors; the one children make, 1/2 + 1/6 = 2/3, is absent. Add it.

**Standard.** Kind A: 7.SP.C.8a, "the probability of a compound event is the fraction of outcomes in the sample space for which the compound event occurs", and 8b, "identify the outcomes in the sample space which compose the event." Kind B: 7.SP.C.7, "Compare probabilities from a model to observed frequencies."

**Foundations first.** Foundations 6 and 7, then 5. An outcome is now a pair: a coin face and a die face. Build the grid: two rows, heads and tails; six columns, 1 to 6; filled row by row, 6, 12; every cell equally likely. "Tails or six" shaded in two colors: the tails row teal, the six column rust, the cell hit twice violet. For kind B, define *simulation* as many trials done by a computer or with random digits, so the result is an experimental probability, and say the two facts: it predicts the share, not the exact count; it comes close, not equal.

**Read.** "A fair coin is flipped and a fair 6-sided die is rolled. What is the probability that the coin shows tails or the die shows 6? Count the outcomes of the sample space, where every outcome is equally likely." Choices 1/12, 7/8, 7/12, 5/12. Gold on *or*. At a glance: "or" is at least as big as the tails row alone, so at least 1/2; the whole is 12 cells, so the answer is over 12.

**The example.** (1) The 2 by 6 grid filled. (2) The tails row shades teal: 6 cells. (3) The six column shades rust: 2 cells, and the corner cell (tails, 6) turns violet because it was hit twice. (4) The count: 6 + 2 − 1 = 7 cells; the violet cell is counted once. (5) 7/12. Rule out: 1/12 is one cell, "tails and six"; 7/8 is not over 12 cells; 5/12 is the unshaded rest. Then the real decoy, spoken: 1/2 + 1/6 = 8/12 would need a thirteenth... would need eight cells, and the grid holds seven. Quick case, a different shape of sample space: three flips, "first and last different"; the organized list of 8 (HHH, HHT, ..., TTT) written as cells; the four with different ends shade; 4/8 = 1/2.

**Second example, kind B.** "Spinner 1 has three equal parts: red, blue and green. Spinner 2 has four equal parts numbered 1 to 4. Both are spun once. The theoretical probability that the first spinner does not land on red and the second spinner lands on a number greater than 2 is 1/3. In 100 trials of a simulation, this happened 40 times. How does the experimental probability compare with the theoretical probability?" (1) The 3 by 4 grid; the two not-red rows and the two greater-than-2 columns overlap in 4 cells of 12: 1/3, the given number confirmed. (2) The strip of 100 trials with 40 shaded, 40/100; on the chance line, 1/3 drops at about 0.33 and 0.40 to its right. (3) Greater. Rule out: "must be equal, so the trials were done wrongly" is always out; "equal" is false on the line; "less" has the dots in the wrong order.

**Fast.** A: grid; shade both; count cells; the overlap once. B: put both fractions on the chance line and read left to right.

**Sense.** A: 7/12 is more than 1/2, as an "or" with the tails row must be. B: experimental near theory, not on it.

**Check.** A: the unshaded cells are 5, and 7 + 5 = 12. B: 1/3 of 100 is about 33, and 40 is 7 more, a plausible wobble in 100 trials.

**Line.** "Or: shade both, count the overlap once. A simulation comes close, not equal."

**Trap.** 1/2 + 1/6 = 2/3: the corner cell counted twice; the violet cell is one cell. Kind B: believing the trials must match the theory; foundation 5 says otherwise, and the chance line shows how close 40/100 is.

**Kit.** `table` fills with violet for a cell hit twice and a live count (4.3); an organized list drawn as a row of labeled cells (the `strip` with TeX cells); two dots on one chance line.

**Writer.** Strongest: two kinds to be read apart, the second an interpretation.
