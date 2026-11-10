# Probability and counting, part 3: nine concepts (precalculus, with one grade-7 foot)

All nine serve (+) standards. The common thread, said once at the top of each film: the sample space is still a set of equally likely cells; only its shape has changed (a tree, a set of groups, a grid gathered into bars, a ledger of many plays).

---

### `multiplication-rule-probability` — And in sequence: multiply along the path. Foundation 10.

**Standard.** HSS.CP.B.8: "Apply the general Multiplication Rule in a uniform probability model, P(A and B) = P(A)P(B|A) = P(B)P(A|B), and interpret the answer in terms of the model." The free-throw kind (probability of the *second* make) is two disjoint paths added: B.7 only in its trivial form. The abstract kind gives P(A) = 0.8 and P(B | A) = 0.2 but expects 4/25; the app should accept 0.16.

**Foundations first.** The tree, built from the rain story: a first stage with its fractions on the branches; a second stage *under each* first branch, because the bus's chance of being late is a share of the mornings that are rainy, and a different share of the mornings that are dry. Beside it the four-region rectangle to scale: the rain slab 4/5 wide, the dry slab 1/5; inside each slab the "late" share colored (1/5 of the rain slab, 3/5 of the dry). A leaf's probability is the area of its colored piece: width times height, the two fractions multiplied. Said once: "The second fraction is a share of a new whole: the part of the world where the first thing happened."

**Read.** The gold words: the pair the question wants ("does **not rain** and the bus is **late**"), and in card problems "**without replacement**". At a glance: an "and" is smaller than either of its parts; "does not rain and late" cannot exceed 1/5.

**The example.** "On a school morning, the probability of rain is 4/5. When it rains, the bus is late with probability 1/5; when it does not rain, with probability 3/5. What is the probability that it does not rain and the bus is late?" (1) Tree: rain 4/5, no rain 1/5; under rain: late 1/5, on time 4/5; under no rain: late 3/5, on time 2/5. (2) Walk the path: the no-rain branch lights (1/5), then its late branch (3/5). (3) In the rectangle the dry slab (1/5 wide) and its late piece (3/5 tall) glow together: 1/5 × 3/5 = 3/25. (4) In the model's words: "3 mornings in 25 are dry and late."

**Second example (without replacement: the second fraction must be built, not read).** "Two cards are drawn without replacement from a standard deck. What is the probability that both are aces?" The 13-by-4 deck grid, the four aces teal. First draw: 4/52. The drawn ace slides out to a tray; the count under the grid rewrites 52 → 51, and one ace is gone: 3/51. Multiply: 12/2652 = 1/221. Quick beat on "king then queen": the king leaves, 51 remain, the queens are untouched: 4/52 × 4/51 = 4/663.

**Quick third case (two paths).** "Makes the second free throw": the second make sits under both first branches. Make-make 1/5 × 2/5 = 2/25, miss-make 4/5 × 1/5 = 4/25; the two leaves light and add: 6/25. The abstract case is the tree with letters: 0.8 × 0.2 = 0.16 = 4/25, one beat.

**Fast.** First fraction, then the fraction on the branch you are standing on, multiply. Without replacement: bottom one smaller; top one smaller only if the first draw used up what you want.
**Sense.** Smaller than each factor. Both aces is tiny; 1/221 is tiny.
**Check.** The four leaves add to 1 (4/25 + 16/25 + 3/25 + 2/25). For the cards: 52 × 51 = 2,652 ordered pairs, 4 × 3 = 12 of them two aces: 12/2,652, the same cells counted directly.
**Line.** "And in sequence: multiply along the path. The second fraction is a share of a new whole."
**Trap.** 4/52 × 4/52: the card is still in the deck. The card leaves the grid before the second fraction is written and the 51 is read off the grid. Also taking "when it rains, late 1/5" as P(late): the late branch hangs under rain, not at the root.
**Kit.** `tree` with `walk` and `scale: true` beside a matched `mosaic`; `table` for the deck with `remove` to a tray and a rewritten total. Nothing beyond the family's 4.3 and 4.5.
**Writer.** Strongest: the lesson is the "share of a new whole" idea and the match between tree and rectangle shown once.

---

### `permutation-count` — Slots multiply, one fewer each time. Foundation 11.

**Standard.** HSS.CP.B.9: "Use permutations and combinations to compute probabilities of compound events and solve problems." This type practices the "solve problems" clause with ordered selections; no probability is asked.

**Foundations first.** Define: *order matters* when swapping two people changes the result (first place and second place are different medals; president and vice president are different jobs). Build the count on the grid first, because the child already owns it: 8 runners, first and second place, an 8-by-8 grid of (first, second); the diagonal (a runner finishing both first and second) is struck; every row keeps 7 cells: 8 rows of 7 is 56. Then the same count as **slots**: two boxes, "first" and "second"; a pool of 8 cards; 8 can fill the first box; the chosen card leaves the pool, so 7 can fill the second. 8 × 7 = 56, the grid's cells. Slots are the grid without drawing it.

**Read.** The gold words: the positions named ("president, vice president, secretary, treasurer"; "first and second"; "left to right"; "in a row"), and "no member can hold more than one office". At a glance: as many factors as positions, starting at the pool size and dropping by one.

**The example.** "A club with 6 members will choose a president, a vice president, a secretary and a treasurer. No member can hold more than one office. In how many ways can the offices be filled?" (1) Four slots with their names under them; a pool of 6 member cards. (2) President: any of 6; a 6 drops into the slot; one card leaves the pool. (3) Vice president: 5 remain; 5 drops; another card leaves. (4) Secretary: 4. Treasurer: 3. (5) The product grows under the row: 6 × 5 × 4 × 3 = 360.

**Quick case.** "In how many orders can 6 books be arranged on a shelf?" Six slots, the pool runs out exactly: 6 × 5 × 4 × 3 × 2 × 1 = 720. Named once: 6 factorial, 6!, which the next lesson uses.

**Fast.** One slot per position; start at n; count down one per slot; multiply.
**Sense.** More than 6 × 5 = 30 (two offices) and less than 6 × 6 × 6 × 6 = 1,296 (if one person could hold them all).
**Check.** Multiply in another order: (6 × 3)(5 × 4) = 18 × 20 = 360. For two slots, count the grid rows.
**Line.** "Slots multiply. One fewer each time."
**Trap.** Members times offices, 6 × 4 = 24; or 6 in every slot, 6⁴. The card leaving the pool on each pick makes the dropping count visible, and the pool shows why it is a product of four factors, not two.
**Kit.** `slots` (4.7) with a **pool**: a row of n cards from which the chosen card slides into the slot as its count drops. The 8-by-8 grid with a struck diagonal is `table` with `fill`.
**Writer.** Capable cheaper writer from this concept; one picture, one product.

---

### `combination-count` — Dividing by the orders forgets the order. Foundation 11.

**Standard.** HSS.CP.B.9 (the "solve problems" clause with unordered selections).

**Foundations first.** Define: *order does not matter* when swapping gives the same thing (a committee where "every member has the same role"; a set of books; a pizza's toppings; a handshake). The words that say so are listed against the words that say order matters. Build on the smallest case the child can list: 4 people, every pair shakes hands. Slots say 4 × 3 = 12 ordered pairs, on the 4-by-4 grid with the diagonal struck. But cell (A, B) and cell (B, A) are one handshake: the mirrored cells slide together and pair off; 12 ordered pairs become 6 handshakes, listed: AB, AC, AD, BC, BD, CD. Every group was counted once per ordering, so divide by the number of orderings of one group.

**Read.** The gold words: "committee", "same role", "set", "does not matter", "handshakes". At a glance: the answer is a whole number, smaller than the slot product, bigger than the number of things.

**The example.** "A pizza will have exactly 3 different toppings chosen from 12. The order does not matter. How many different topping combinations are possible?" (1) Three slots: 12 × 11 × 10 = 1,320 ordered choices. (2) Take one group, say pepper, mushroom, olive: the **collapse** shows its orderings as six cards (3 × 2 × 1 = 6, the slot count for arranging three), which stack into one pizza. (3) Every group was counted 6 times, so 1,320 ÷ 6 = 220. (4) Named once: "12 choose 3", written C(12, 3) or the stacked symbol, is this count.

No second example: Student L's 6 books (6 × 5 × 4 ÷ 6 = 20) and the committee of 3 from 11 (11 × 10 × 9 ÷ 6 = 165) are the same act; the k = 2 case is the handshake foundation.

**Fast.** k slots counting down from n, divided by k!.
**Sense.** Far fewer than 1,320; more than 12.
**Check.** Multiply back: 220 × 6 = 1,320. For the handshakes, the list has 6.
**Line.** "Slots multiply. Dividing by the orders forgets the order."
**Trap.** Two real ones. Leaving the slot product (1,320: a pizza is not six pizzas); and dividing by 3 instead of 6, because "three toppings were chosen". The collapse shows six cards, not three, and says why: three choices for which topping is named first, two for second, one left.
**Kit.** `slots` with `collapse` (4.7); the 4-by-4 grid whose mirrored cells pair off is a small `table` motion (two cells sliding to meet).
**Writer.** Capable cheaper writer from this concept.

---

### `combination-probability` — Favorable groups over all groups, both counted the same way. Foundations 2 and 11.

**Standard.** HSS.CP.B.9: "compute probabilities of compound events."

**Foundations first.** Say what the problem's own sentence gives: "every group of 3 is equally likely" means the cells are the *groups*, not the people. So the probability is foundation 2 again: favorable groups over all groups. Build the whole: 7 members, groups of 3: 7 × 6 × 5 ÷ 6 = 35 groups, drawn as a strip of 35 cells. Then build "exactly 1 junior" as a product of groups: choose which junior (3 ways) *and* which pair of seniors (4 × 3 ÷ 2 = 6 ways); a grid 3 rows by 6 columns, 18 cells, each a different committee. The counting principle on groups.

**Read.** The gold words: "exactly 1", "none", "all 3", and the group size. At a glance: a fraction between 0 and 1; the favorable count is a product of one combination per kind; the whole is one combination.

**The example.** "A club has 3 juniors and 4 seniors. A committee of 3 is chosen at random, so every group of 3 is equally likely. What is the probability that exactly 1 is a junior?" (1) All groups: C(7, 3) = 35; the strip. (2) Favorable: C(3, 1) × C(4, 2) = 3 × 6 = 18; the 3-by-6 grid of committees. (3) The 18 cells of the strip shade: 18/35. (4) In words: "18 of the 35 possible committees have exactly one junior."

**Quick case (one kind only).** "6 juniors and 7 seniors; none is a junior": choose 0 juniors (one way: take none) and 3 seniors, C(7, 3) = 35; all groups C(13, 3) = 286: 35/286. The "all 3 juniors" variant is the mirror.

**Fast.** All groups: one combination. Favorable: one combination per kind, multiplied. Divide, reduce.
**Sense.** Juniors are 3 of 7, so one junior in three picks is the common case: around half, and bigger than the other kinds.
**Check.** The kinds fill the strip: 0 juniors C(4, 3) = 4, 1 junior 18, 2 juniors C(3, 2) × 4 = 12, 3 juniors 1; 4 + 18 + 12 + 1 = 35. Seen as the strip sorted into four colors.
**Line.** "Count favorable groups and all groups the same way."
**Trap.** Mixing ordered and unordered: 3 × 4 × 3 = 36 ordered picks over 35 groups, a probability over 1. Or forgetting the seniors: 3/35. The grid of committees shows every junior paired with every senior pair, and both counts are built from the same collapse.
**Kit.** `strip` of 35 cells sorted into kinds; a `table` whose cells hold committee names. Nothing new.
**Writer.** Strongest first (the choice to count both the same way is the idea); move after a blind test.

---

### `random-variable-distribution` — One number for every outcome; the shares add to 1. Foundation 12.

**Standard.** HSS.MD.A.1: "Define a random variable for a quantity of interest by assigning a numerical value to each event in a sample space; graph the corresponding probability distribution." HSS.MD.A.3 for the probabilities by counting. Four kinds under one name (definition choice; P(X = k) by counting; a probability read from a bar chart; a missing probability). One caution: the decoy "whether the two numbers match" *could* be coded 1 or 0; the lesson says "as written, that is a yes or no, not a number", and the app should either add "as stated" or use decoys that are plainly not numbers.

**Foundations first.** A *random variable* is a rule that gives every outcome one number. Build: three children, the 8 equally likely outcomes BBB, BBG, ... GGG as a strip of 8 cells; X = number of girls; each cell's number written on it; the cells **gather** into bars over 0, 1, 2, 3: heights 1, 3, 3, 1 of 8. That bar chart is the *distribution*: the shares, labeled as fractions, and they **stack to one**. The values are not equally likely even though the outcomes are.

**Read.** For a definition question: does the rule give a *number* for each outcome? A name, a yes or no, a pair, or "which die" is not a number. For a probability: which cells have that value, over all cells; "X ≤ 2" adds bars. For a chart: the bar heights are *counts of outcomes*; the total is the denominator. For a missing probability: the rest of 1.

**The example (P(X = k) by counting).** "A fair coin is tossed 4 times. Let X be the number of heads. What is P(X = 2)?" Choices 1/16, 3/8, 3/4, 6/17. (1) The 16 equally likely strings, 4 rows of 4 (HHHH ... TTTT). (2) Each cell counts its heads; the cells gather into bars over 0 to 4: heights 1, 4, 6, 4, 1. (3) Six cells under 2: 6/16 = 3/8. (4) Stack: the five bars fill the unit strip.

**Quick cases, one each.** Definition (three children): "number of girls" gives a number; the others dim together ("whether", "last name", "the order" are not numbers). Chart: scores with bar heights that total 19 outcomes; P(X ≤ 2) is the two bars at or below 2, 9 cells, over 19: 9/19 (the writer takes the app's actual chart). Missing: 3/20 + 1/20 + 1/20 = 5/20, so a = 15/20 = 3/4; the bars stack and the gap is the answer.

**Fast.** Count the cells with that value; divide by all cells. Missing: 1 minus the rest.
**Sense.** Two heads of four is the middle, most common value, but well under 3/4.
**Check.** Stack the bars to 1; recount the strip.
**Rule out.** A denominator that is not the cell count (6/17 with 16 strings); a count where a share is asked ("9"); a missing probability that does not bring the sum to 1 (5/7, 7/10) or equals the sum of the others (1/4). All dim together.
**Line.** "Equally likely outcomes, not equally likely values."
**Trap.** "X can be 0, 1, 2, 3 or 4, so P(X = 2) = 1/5." The gather shows one cell under 0 and six under 2.
**Kit.** `dist` with `gather` from a `strip` whose cells carry TeX labels (strings), `stack`; the app's bar chart scene for the chart kind. Nothing beyond 4.6.
**Writer.** Strongest: four asks, one of them about language.

---

### `theoretical-distribution-expectation` — Gather the grid; imagine one play per cell. Foundations 12 and 13.

**Standard.** HSS.MD.A.3: "Develop a probability distribution for a random variable defined for a sample space in which theoretical probabilities can be calculated; find the expected value." HSS.MD.A.2 ("interpret it as the mean") and B.5a ("the expected payoff for a game of chance"). Four kinds: P(X ≥ 11) for two dice; the dice game's expected net gain; P(X = 3) for three independent shots; E(X) of the shots' distribution. The last duplicates `expected-value`; it rides here because the shots kinds share one story.

**Foundations first.** The 6-by-6 grid of two dice, 36 equally likely cells, each holding its sum. **Gather** by sum: the diagonals slide into columns over 2 to 12, heights 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1 of 36, labeled. Then expected value as a mean, foundation 13: imagine one play per cell, 36 plays, add what happens, divide by 36. It is the balance point of the bars, not something one play can give.

**Read.** Gold: the winning sums, the win and the loss, "net gain", "exactly". At a glance: the answer sits between the lowest and highest payoff and nearer the likelier one; a probability is cells over 36.

**The example.** "You roll two fair dice. If the sum is 11 or 12, you win 7 dollars; otherwise you lose 3 dollars. Let X be your net gain. Find E(X) exactly." Choices −37/6, −13/6, 7/12, −78. (1) On the grid, the cells summing to 11 or 12 go teal: (5, 6), (6, 5), (6, 6), three cells; the other 33 go rust. (2) The distribution has two bars: +7 with 3/36, −3 with 33/36. (3) One play per cell: 3 plays win 7, total 21; 33 plays lose 3, total −99; net −78 over 36 plays. (4) −78/36 = −13/6 dollars per play, about −2.17. The **balance**: the fulcrum settles at −13/6, just right of −3. (5) In words: "Play many times and you lose about two dollars seventeen per game on average."

**Quick cases.** P(X ≥ 11) on the same shaded grid: 3/36 = 1/12. The shots: three independent shots at 1/3, P(X = 3) is one path, 1/3 × 1/3 × 1/3 = 1/27 (the tree; one beat that P(X = 1) adds three paths, which is where C(3, 1)(1/3)(2/3)² comes from). E(X) for the shots' distribution 8/27, 12/27, 6/27, 1/27: 27 plays: 0 × 8 + 1 × 12 + 2 × 6 + 3 × 1 = 27 made shots; 27/27 = 1. Sense: three shots at a third each, one made shot.

**Fast.** Shade the grid, read each payoff's cell count, multiply value by count, add, divide by 36. Or value × probability summed; the lesson shows they are the same sum.
**Sense.** 33 of 36 plays lose, so the answer is negative and near −3.
**Check.** 7 × 1/12 − 3 × 11/12 = 7/12 − 33/12 = −26/12 = −13/6. The two probabilities add to 1.
**Rule out.** −78 is the total over 36 plays and lies outside the payoff range; −37/6 is below −3; 7/12 is positive when losing is far likelier (it is the win term alone). Only −13/6 survives.
**Line.** "Imagine one play per cell, then take the mean."
**Trap.** The plain average of the payoffs, (7 − 3)/2 = 2; and "P(sum = 12) = 1/11". The gather shows one cell under 12 and the leveling shows 36 plays, not two.
**Kit.** `dist` with `gather` from a `table` of sums, `level` for 36 plays, `balance` on an axis that runs negative; `tree` for the shots. Needs the value axis to include negatives (new in 4.6).
**Writer.** Strongest: the gather and the leveling are the design.

---

### `empirical-distribution-expectation` — The observed shares are the probabilities; the expected value is the data's own mean. Foundations 5, 12, 13.

**Standard.** HSS.MD.A.4: "Develop a probability distribution for a random variable defined for a sample space in which probabilities are assigned empirically; find the expected value. For example ... the expected number of sets per household. How many TV sets would you expect to find in 100 randomly selected households?" The app asks exactly these three: a relative frequency as an estimated probability, the expected value per trial, the expected total for a larger group. The chart differs by seed; the writer reads the real figure.

**Foundations first.** The bar chart of counts, and how it was made: one household at a time drops into the column of its car count. The total is the bars added. Divide every bar by the total and the counts become *relative frequencies*: the bar heights rescale on the word, the axis renames itself, and the new heights add to 1. These shares are the estimated probabilities (foundation 5: the share seen in trials). The expected value is the mean of the distribution, which is the ordinary mean of the 25 observations the child computed from a frequency table in grade 6.

**Read.** Gold: "per household" (a per-trial average), "probability that the number is 2" (one bar over the total), "1000 households ... in total" (scale up). At a glance: a probability is under 1; a per-trial average lies between the smallest and largest value; a total is about the average times the group.

**The example.** "The bar chart shows the number of cars in each of 25 households. Use the relative frequencies as estimated probabilities. Find the expected number of cars per household." Choices 0.28, 45, 0, 1.8. With a chart consistent with the brief's instance: 0 cars 2 households, 1 car 7, 2 cars 10, 3 cars 6. (1) Total: 2 + 7 + 10 + 6 = 25, written under the chart. (2) Divide every bar by 25: 0.08, 0.28, 0.40, 0.24; they add to 1.00. (3) Value × share: 0 + 0.28 + 0.80 + 0.72 = 1.80. (4) The faster same sum: total cars 0 + 7 + 20 + 18 = 45, over 25 households: 1.8. The fulcrum settles at 1.8, between the tall bars at 1 and 2.

**Quick cases.** P(X = 2) from a 50-day chart: the one bar over the total, 17/50 = 0.34. Scale up: 1.8 cars per household times 1,000 households is about 1,800 cars (the app's instance has its own chart and gives 2,040).

**Fast.** Total the bars; value times count, added, over the total. Scale: times the group size.
**Sense.** Between 0 and 3, near the tallest bars.
**Check.** The shares add to 1; the two ways of computing agree (45/25 = 1.8).
**Rule out.** A count (45, 48, 6) is not a probability or a per-trial average; 3.4 is over 1 and over the largest value; "2" is the most common value, not the mean; 2.04 per household is not a total and 2,000 assumes exactly two per household. Dim together.
**Line.** "Observed shares estimate the probabilities; the expected value is the data's mean."
**Trap.** Dividing by the number of bars: (0 + 1 + 2 + 3)/4 = 1.5, treating the values as equally likely; or 1/5 for "one of five values". The total written under the chart is the only denominator on screen.
**Kit.** The app's bar chart scene with the "divide every bar by the total" rescale (4.6), `stack`, `balance`. Nothing new.
**Writer.** Capable cheaper writer from this concept.

---

### `fair-selection-procedure` — Fair means every person owns the same share of the outcomes. Foundations 2, 3, 12, 14.

**Standard.** HSS.MD.B.6: "Use probabilities to make fair decisions (e.g., drawing by lots, using a random number generator)." 7.SP.C.7a for the uniform model underneath. Two kinds: the chance of one student under a stated procedure (three procedures appear), and choosing the fair procedure.

**Foundations first.** Define *fair*: every person has exactly the same chance. Build the fair case so the picture of fairness exists: 7 slips in a bag, lined up into a strip of 7 cells, each labeled with one student; every student owns one cell: 1/7 each, seven equal shares that fill the strip. Then the test for any procedure: line up its equally likely outcomes as cells, color each cell by the student it picks, and read each student's count. Fair only if every count is the same. A first glance that settles many cases: if the number of outcomes is not a multiple of the number of people, the shares cannot be equal.

**Read.** Gold: the device ("two fair six-sided dice", "a fair 12-sided die"), the rule that turns a result into a student ("sum − 1", "the remainder", "rolling again whenever"), and the student asked. At a glance: 36 outcomes for 11 students, 12 for 11: neither divides, so neither is fair, and 1/11 is already wrong for those.

**The example.** "To pick one of 11 students numbered 1 to 11, a teacher rolls two fair six-sided dice and chooses the student numbered (sum − 1). What is the probability that student 1 is chosen?" Choices 1/18, 1/12, 1/36, 1/11. (1) The 36-cell grid of dice. (2) Each cell's student: sum − 1; the cells **gather** into bars over students 1 to 11: heights 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1. (3) Student 1 is sum 2, one cell: 1/36. Student 6 is sum 7, six cells: 1/6. (4) In words: "Student 6 is six times as likely as student 1. The procedure is not fair."

**Quick cases.** The 12-sided die by remainder: 12 cells; cells 1 to 11 go to students 1 to 11, cell 12 to student 1 again (remainder 1); student 10 owns one cell: 1/12, and student 1 owns two: the unfairness in one glance. The repair: a 12-sided die for 9 students, roll again above 9: cells 10, 11, 12 leave to the tray, the whole shrinks to 9 equal cells: 1/9, fair. The choice kind (7 students): a six-sided die never reaches 7 (dims at once); the 12-sided remainder has 12 cells for 7 students, not a multiple (dims); six coin flips give heads counts 0 to 6 with shares 1, 6, 15, 20, 15, 6, 1 of 64 (the gather the coin lesson built; dims); the slips in a bag: seven equal cells.

**Fast.** Line up the outcomes, count each person's cells over all cells; fair only if the counts match. Discarded outcomes leave the whole.
**Sense.** 36 outcomes cannot split evenly among 11 people.
**Check.** Every student's share added: (1 + 2 + ... + 6 + ... + 1)/36 = 36/36.
**Rule out.** 1/11 is what a fair procedure gives, and this one is not fair; 1/12 and 1/18 use a whole that is not the 36 cells. Dim together.
**Line.** "Fair means every person owns the same share of the outcomes."
**Trap.** "The student numbers run 1 to 11, so each is 1/11": equally likely values again. The gather shows the triangle.
**Kit.** `table` gathered into `dist` with the bars labeled by student; `strip` with named cells and `remove` to a tray for re-rolls. Nothing new.
**Writer.** Strongest: a verdict with a reason, and the unfairness has to be seen, not computed.

---

### `strategy-expected-value` — Compare the averages, not the prizes. Foundations 13 and 14.

**Standard.** HSS.MD.B.5b: "Evaluate and compare strategies on the basis of expected values"; B.7: "Analyze decisions and strategies using probability concepts"; B.5a and A.2 underneath. Three kinds: four games by expected net gain; a warranty against expected repair cost; a sure amount against a gamble, each answered by the statement the expected values justify.

**Foundations first.** The *expected net gain per play*: what you win on average per play over many plays, after paying to play. Build it as a ledger of equally likely plays: Game A costs 6 and wins 20 half the time; two plays, one wins 20, one wins 0, both pay 6: 20 − 12 = 8 over two plays, 4 per play. The same as chance × prize − cost: 1/2 × 20 − 6 = 4. Drawn as a bar of plays shaded by the chance (the bar's double scale), with the cost as a rust bar subtracted from every play. Said once: a decision rests on the average, and the average assumes the stated chances are right and you could play many times.

**Read.** Gold: each game's cost, prize and chance; "expected"; for the warranty, "expected costs"; for the gamble, "sure". At a glance: a game whose expected prize is below its cost loses money; two games with the same chance are settled by prize minus cost with no arithmetic (B beats A below: same chance, bigger prize, lower cost). A statement's *reason* must mention expected value; a reason that compares one prize with one cost ignores the chance.

**The example.** "Four games are offered. Game A: pay 6; win 20 with probability 1/2. Game B: pay 2; win 39 with probability 1/2. Game C: pay 4; win 38 with probability 2/5. Game D: pay 3; win 15 with probability 3/4. Which game has the greatest expected net gain per play?" (1) A table filled row by row: chance, prize, expected prize, cost, net. A: 10 − 6 = 4. B: 19.5 − 2 = 17.5. C: 15.2 − 4 = 11.2. D: 11.25 − 3 = 8.25. (2) Beside each row a bar for its net gain, to scale, so B's is visibly longest. (3) Game B. (4) In words: "Over many plays, B pays about 17.50 a play on average; D's high chance does not make up for its small prize."

**Quick cases.** Warranty 80 against a 6/25 chance of a 500 repair: 25 years, 6 of them cost 500, 3,000 over 25: 120 expected repair cost, more than 80, so buy it; the statement must say 120 against 80. Sure −10 against a gamble of 47 with 1/5 or −33: five plays, one wins 47, four lose 132: −85 over 5 = −17, less than −10, so take the sure amount.

**Fast.** Chance × prize − cost for each option; highest net wins. For a sure amount, compare it with the gamble's expected value.
**Sense.** Between the worst and best result of each option and nearer the likelier one; the gamble loses four times in five, so its average is negative.
**Check.** Recompute B over 100 plays: 50 wins of 39 is 1,950, cost 200, net 1,750, 17.50 a play.
**Rule out.** For the games: a candidate whose expected prize is below another's with the same or higher cost. For the statements: a reason with no probability in it ("500 is more than 80") dims even when its verdict matches; a figure outside the payoff range or with the wrong sign (31 and 47/5 are positive for a gamble that mostly loses; 380 is not a cost anyone expects) dims; "equally good" dims because the expected costs differ.
**Line.** "Chance times prize, minus the cost. Compare the averages, not the prizes."
**Trap.** Picking the biggest prize or the highest chance; forgetting the cost; and the right verdict for a reason that ignores the chance. The table has a column for each piece, and the chosen statement is read against it.
**Kit.** `table` filled row by row with a to-scale net bar beside each row, able to run negative from a zero line; the ledger of plays is the existing `bar` with the cost as a subtracted bar. The negative bar is the one addition.
**Writer.** Strongest: the quality is in the justified reason and the wrong-reason decoys.
