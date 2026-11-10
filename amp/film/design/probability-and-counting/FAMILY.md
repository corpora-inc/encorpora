# Probability and counting, grade 7 to precalculus: family design

Fourteen skills, 29 problem types. Planning snapshot: the catalog, the engine templates and the generated examples, snapshot 2026-11-09. This design covers the idea, the foundations in the order they are built, the picture system, how the lessons go, the kit, the seam, the misfilings, and the pilot. Per-type concepts use these foundations and pictures.

Nothing here is a rule list. It is one idea, one picture that grows from a row of boxes into a grid, a tree and a bar chart without ever changing its meaning, and the habits that make every problem in the family a careful read.

---

## 1. The idea underneath the whole family

**Probability is a share.** Count the outcomes you want, count all the equally likely outcomes, divide. The number you get is a fraction of a whole, and the whole is "everything that could happen". Every lesson from grade 7 to precalculus is this share, with one of four things changing:

- *what counts as an outcome* (a single draw; then a pair; then a group of three);
- *what counts as everything* (the whole bag; then only the given row);
- *how to count without listing* (multiply along a branch; fill the slots; divide out the orders);
- *what the share predicts* (a count in many trials; an average per play; a fair decision).

A child who sees the share, and knows which of the four is changing, owns the family. The foundations, in the order they are built; each later lesson stands on the ones above it and names them in one line.

**Grade 7**

1. **Chance is a number from 0 to 1.** 0 is impossible, 1 is certain, 1/2 is as likely as not; bigger means more likely. Every probability lives on this line, so an answer like 7/6 or −1/4 is nonsense before any checking. Taken from the number line (P3, family 6) and fractions as points on it (family 9).

2. **When every outcome is equally likely, the probability is the share.** One box per outcome, the boxes you want shaded; the probability is shaded over all. The denominator is *everything*, never "the rest": 4 red and 8 blue is 4 out of 12, not 4 out of 8. Taken from family 9: a fraction is a count of equal pieces of a stated whole.

3. **The equally likely things are the pieces, not the names.** A spinner with 3 red, 1 blue and 6 orange sections has three colors, but ten equal sections; red is 3/10, not 1/3. The picture lines up the ten sections, not the three colors. This is the uniform model of 7.SP.C.7a and the single most common error in the grade.

4. **"Not" is the rest of the strip.** The shaded and the unshaded together fill the whole, so P(not A) = 1 − P(A). Later this one fact gives "at least one" (one minus none) and the complement of any set.

5. **Probability predicts the share, not the exact count; more trials, closer.** Roll a fair cube 90 times and expect about 15 sixes, probably not exactly 15. The share seen in trials is the experimental probability; it wobbles when trials are few and settles when they are many. A prediction for n trials is probability × n. Taken from family 10 (a fraction of an amount, on the bar's double scale) and 32 (frequency, relative frequency).

6. **An outcome of two things is a pair, and pairs make a grid.** One row per outcome of the first thing, one column per outcome of the second; the grid has rows × columns cells, all equally likely. A compound event is still a share: shaded cells over all cells. Counting the cells by rows is the counting principle. Taken from family 7: the array is rows times columns.

7. **"Or" shades both regions and counts the overlap once; "and" is the overlap.** On the grid, "tails or six" is the tails row plus the six column with the corner cell counted once: 6 + 2 − 1 = 7 of 12, not 1/2 + 1/6. Named later as the addition rule.

**High school**

8. **"Given" shrinks the whole.** Given B, everything outside B dims; the probability of A given B is the share of B's outcomes that are also in A, so the denominator is B's count, not the total. Taken from family 33: the two-way table.

9. **Independent means the share is the same inside every group.** Knowing B happened does not change the chance of A: P(A | B) = P(A), which is the same as P(A and B) = P(A) × P(B). "Can't both happen" is not independence; it is the opposite: if they never overlap, knowing one happened makes the other impossible.

10. **"And" in sequence multiplies along the path.** P(A then B) = P(A) × P(B given A): the second fraction is a share of a new whole, the part of the world where A happened. Without replacement the second whole is one smaller. The tree's branches and the area rectangle's slabs are the same numbers.

11. **Count without listing: slots multiply; dividing by the orders forgets the order.** Positions filled one at a time multiply (6 × 5 × 4 × 3 offices). When order does not matter, every group was counted once per ordering, so divide by k!. A probability by groups is favorable groups over all groups, both counted the same way.

12. **A random variable gives each outcome a number; its distribution is the shares, and the shares add to 1.** The sum of two dice is not 11 equally likely numbers; it is 36 equally likely cells gathered by their sum into eleven bars of different heights. Taken from family 32: the bar chart, the frequency table.

13. **Expected value is the mean of the distribution: the average per play if you played forever.** Each value times its share, added; or, the sure way for a child, imagine one play per equally likely piece (or d plays for a common denominator d) and take the ordinary mean. Subtract any cost to play. It is a balance point, not a result you can get on one play. Taken from family 32: the mean as leveling and as balance point.

14. **Decide by expected value, and say what it assumes; fair means equal shares.** A strategy is better when its expected payoff is higher, given the stated probabilities. A procedure is fair when every person owns the same share of the outcomes, checked by counting the cells that pick each person.

What this family gives onward: 33 (a random sample stands for the whole; a result is evidence only against chance; randomization tests) and the binomial coefficients of family 12's binomial theorem.

---

## 2. The visual language: one box per outcome, drawn to scale, from strip to grid to tree to bar chart

One picture system for all fourteen skills. The precalculus student gathering 36 dice cells into a bar chart must recognize the row of twelve boxes they shaded in grade 7, and see that only the shape of the sample space has changed.

### The shapes

| Shape | What it is | Means |
|---|---|---|
| **cell** | one equal box, holding a counter, a color, a number or a name | one equally likely outcome |
| **strip** | a row of n cells of equal width, total length exactly 1 | the sample space of one thing; its length is the whole, 1 |
| **grid** | rows × columns of equal cells (the kit's `table`) | the sample space of two things; a deck is 13 by 4; two dice are 6 by 6 |
| **four-region rectangle** | a rectangle of area 1 split into A / not A across and B / not B down (the kit's `mosaic`) | two events over one sample space, to scale: both, only A, only B, neither |
| **tree** | stages of branches with a fraction on each branch, products at the leaves | a sequence of chance steps; branch widths match the slabs of the rectangle beside it |
| **slots** | empty boxes in a row for positions | a count of arrangements; the number of choices drops into each box |
| **distribution** | bars over values, heights are probabilities, each labeled as a fraction | a random variable; the bars laid end to end make the unit strip |
| **chance line** | a number line from 0 to 1 with the words impossible, unlikely, as likely as not, likely, certain | where a probability lives; the strip's own top edge |

The scale is never faked. A probability of 3/10 is three cells of a ten-cell strip, and those three cells cover exactly 3/10 of the chance line underneath. Slab widths in the four-region rectangle are the probabilities. Bar heights in a distribution are the probabilities. The dot on the chance line sits at its true value.

Bags, spinners, dice and cards are drawn as themselves first (counters in a bag outline; a circle cut into n equal sectors with a pointer; a die face; a 13-by-4 deck), to scale, and then **lined up** into the strip or grid. The lining up is the lesson: it makes foundation 3 visible before a single fraction is written.

The Venn diagram is drawn when the problem draws it, with counts in its regions, because the learner meets it in the app and on tests. It is a sorting picture, not a scale picture: its region areas mean nothing, and the lesson never asks the eye to compare them. When shares matter, the Venn's four numbers are read once into the four-region rectangle, which is the same four numbers to scale.

### Color means one thing each

- **teal** (accent): outcomes in the event asked about, and the numerator of its fraction.
- **rust** (warm): a second event in an "or" or "and", or the second stage of a process; the second number in a comparison.
- **violet**: outcomes in both events: the overlap. The one color that means "counted in two places".
- **gold**: the one thing being looked at right now: the word in the question that decides the reading ("or", "given", "at least one", "without replacement"), the cell being counted, the fulcrum under a distribution. One gold thing at a time.
- **muted**: outcomes outside the event; everything outside the given; the "neither" region; ruled-out choices. Unshaded cells are always still drawn, because the denominator counts them.
- Never a tinted background on an answer; never a bar, slab or cell that is not the size it claims.

### The motions (each one proves a foundation)

- **Line up** (bag to strip): counters slide out of the bag into a row of equal cells, same colors together; a spinner **unrolls**, its sectors becoming the cells of a strip in order. The count label reads the total. Foundation 3: the equally likely things are the pieces.
- **Shade and sort**: the cells in the event turn teal; the count ticks; the fraction writes as shaded over all; the shaded cells slide together to the left so their total length can be read on the chance line. The sort proves that the share is the same wherever the outcomes sit. Foundation 2.
- **Drop**: a dot falls from the right edge of the shaded run onto the chance line below; the word band it lands in lights. Foundation 1.
- **Flip to the rest**: the shaded and unshaded cells swap colors; the two counts are written and added to the total. Foundation 4, and "at least one" later.
- **Run** (experimental): trial results fall one at a time into a frequency chart while a running share "k of n" updates; beside it a line traces the running share against the number of trials, wild at first, then hugging a dashed line at the true probability. Foundation 5: more trials, closer. A prediction for n trials is the bar of n shaded by the probability (the bar's double scale: share above, count below).
- **Fill the grid**: rows fill one at a time, the count ticking by rows (6, 12): the counting principle as an array. Then cells shade for the event. Foundation 6.
- **Shade twice, count once**: event A's cells turn teal, event B's rust, and the cells hit twice turn violet; the three counts are written, A + B − both. Foundation 7. On the four-region rectangle the same move shows "neither" as the uncolored corner.
- **Shrink to the given**: everything outside the given row, column, circle or slab dims; the denominator rewrites itself as the given's count; the share of what stays bright is read. Foundation 8. (The kit's `given` on tables and mosaics already does this.)
- **Straight edge**: the four-region rectangle's colored parts line up on one straight edge when the events are independent and break when they are not. Foundation 9. (Exists.)
- **Walk the path**: a tree branch lights, then the next; the fractions multiply at the leaf; beside the tree the matching slab narrows to its share and the leaf's probability is the slab's area. For "without replacement", the drawn card leaves the deck grid to a tray and the denominator rewrites 52 to 51. Foundation 10.
- **Fill the slots; collapse the orders**: choices drop into the position boxes and multiply; then, for a combination, the k! orderings of one chosen group stack into a single card, and the product is divided by k!. Foundation 11.
- **Gather**: grid cells with the same value slide into a column over that value, building the distribution bar by bar; the two-dice grid's diagonals become the triangle of sums. Foundation 12.
- **Stack to one**: the distribution's bars lay end to end and exactly fill the unit strip. The check that the shares add to 1, seen.
- **Level and balance**: one stack per equally likely piece (or per 1/d), leveled to one height: the mean (family 32's motion); then a beam under the distribution with a fulcrum that slides until it balances at the same number. Foundation 13.
- **Rain** (area): random dots fall on a region; the count landing in the shaded part over all dots is written and approaches the area share. It shows what "a point chosen at random" means and ties area probability to foundation 5.
- **Dim** (multiple choice): choices that cannot be right fade to muted together, in one beat, with the one reason said aloud. Never struck one by one.

### The sketch

What the learner draws on scratch paper, which the films draw first:

- one thing: a row of boxes, or just "4 of 12";
- two things: a grid, rows by columns, cells for the event ticked;
- two events over one group: a 2 × 2 table with the four numbers (both, only A, only B, neither), the given row circled;
- a sequence of draws: a tree with a fraction on every branch;
- positions: slots with a number in each;
- a random variable: a two-row table, value over probability, the probabilities added to 1, then value × probability summed.

---

## 3. How the lessons go

Each film opens by saying what we are looking at and building it: the strip from the bag, the grid from the two spinners, the four-region rectangle from the table, the tree from the story. Words are defined on the moment they appear, in plain words: an *outcome* is one thing that can happen; an *event* is the outcomes we are asking about; *equally likely* means each has the same chance; the *sample space* is every outcome; a *trial* is one run of the experiment. Then the five habits, which every film in the family builds the same way.

**1. Read.** The problem is read aloud exactly as the app shows it, with its choices. Three things are found before any work, and the word that settles each goes gold:
- *What is random?* One draw, one spin, two spins, a draw without putting it back, a point anywhere on a board.
- *What counts as success?* "Red"; "odd"; "less than 5"; "tails **or** six"; "**at least one**"; "**given** that the household owns a dog"; "**among** days that are rainy"; "**exactly** one junior"; "**neither**".
- *What is everything?* All twelve counters; all 36 cells; only the 26 dog-owning households; all C(9, 3) groups of three.
One beat says what the answer must look like: a fraction between 0 and 1; a whole number of ways; a set; a percent; a value between the smallest and largest payoff.

**2. At a glance.** More or less than half? Near 0 or near 1? "Or" is at least as big as each part; "and" is at most as small as each part; "given" has the given group's count under the line; "at least one" is usually big and is one minus the small "none". For a two-way table, the row total is already the denominator. For a distribution, the probabilities must add to 1, so a missing one is 1 minus the rest. For a spinner, the count of sections, not the count of colors.

**3. The sure fast way.** The shortest path that always works, shown on the picture. Each of these is taught as the method with the picture that shows why; none fails:
- Equal pieces: count the cells you want, count all the cells, write the fraction, simplify.
- Not: 1 − P. At least one: 1 − P(none), where "none" is the one unshaded corner rectangle of the grid, whose size is (1 − p)(1 − q).
- Two different devices: the grid; "both" is a rectangle of cells, so it is the product; "or" is add and subtract the overlap once.
- Given: shrink the whole to the given group; its count goes under the line.
- Independence test: compare P(A | B) with P(A) (the same share inside the given group as overall), or P(A and B) with P(A) × P(B).
- In sequence: multiply along the path; with replacement the second fraction has the same bottom, without replacement one smaller (and the top changes if the first draw used up what you want).
- Positions: slots multiply; groups: slots divided by k!. A probability by groups counts favorable groups and all groups the same way.
- Expected value: imagine one play per equally likely piece (or d plays), add the payoffs, divide by the plays; subtract the cost. It is the ordinary mean the child already knows.
- Percents: treat 100 people as 100 cells; "or" is add then subtract both; "neither" is 100 minus "or".
- Area: the shaded area over the whole area, with π kept exact.

Shortcuts the family never teaches, because they sometimes fail and children believe them: "more outcomes means more likely" (false when outcomes are not equally likely: dice sums), "if they can't both happen they are independent" (false), "P(A given B) is the same as P(B given A)" (false), "for 'and', add" and "for 'or', add" (false whenever there is an overlap).

**4. Sense.** Before boxing: between 0 and 1; on the right side of half; "or" bigger than each part; "and" smaller than each; the expected value between the lowest and highest payoff and nearer the likelier ones; the experimental share near the theoretical one but not equal; a conditional probability that uses the given count.

**5. Check.** After boxing, the exact check: count the unshaded cells and confirm shaded + unshaded = all; add the complement to get 1; stack the distribution to one; multiply P(A | B) by P(B) and get P(A and B); recount the grid by columns after counting by rows; for a count of ways, list the first few and see the pattern hold; for a fair procedure, add every person's share and get 1. For multiple choice, the ruled-out choices dim together with their reason, then the chosen one is proved.

### Ruling out nonsense, fast

- Anything over 1 or under 0.
- An "or" smaller than one of its parts; an "and" bigger than one of its parts.
- A "given" answer whose denominator is the whole group (7/49 when the question says given dog: the whole is 26).
- A statement that puts the percent in the wrong group: "P(B given A) = 0.55" means *among A-days*, 55% are B; a choice that says "among B-days" or "of all days" is gone at once.
- A statement that uses the right conclusion with a wrong reason ("buy the warranty: a repair costs 500, more than 80"): the reason ignores the probability, so it dims even though its verdict happens to match. The question asks what the expected values justify.
- "No one is in both, so they are independent": the opposite of the truth.
- An expected value outside the range of payoffs, or one that forgot the cost.
- A "count of ways" that is a fraction, or a probability that is a count.

### The misconceptions, from what children actually do

Each is real, common and named here because the lesson's picture is chosen to make it impossible.

- **Counting colors, not pieces.** "Three colors, so red is 1/3." The spinner unrolls into ten equal cells before any fraction is written.
- **The rest instead of everything.** 4 red, 8 blue → "4/8". The strip's full length is the denominator and reads 12 under the line; the odds-style fraction has no place on the chance line.
- **Adding for "or" across two devices.** 1/2 + 1/6 = 2/3 for "tails or six". The grid shows the corner cell shaded twice; counting cells gives 7, and 8/12 would need a thirteenth cell.
- **Adding, or averaging, for "and" / "both".** The grid shows "both" as a rectangle of cells, a product.
- **Expecting the exact predicted count.** "90 rolls, so exactly 15 sixes." The run shows 20; the standard's own words, "roughly ... but probably not exactly".
- **Trusting few trials, or the bigger fraction.** Student J's 4/12 against Student C's 40/120: same fraction, but the running-share line from 12 trials is still swinging. More trials, closer.
- **Not equally likely treated as equally likely.** Eleven dice sums, so "P(sum = 12) = 1/11"; "student 1 and student 6 have the same chance". The gather shows one cell under 12 and six under 7.
- **Given confused with and; given A confused with given B.** 7/49 instead of 7/26; "among frost days" read as "among rainy days". The shrink dims the rest; the given group is the one after "among" or "given".
- **Disjoint mistaken for independent.** The four-region rectangle with an empty "both" region has no straight edge.
- **Without replacement, same denominator.** 4/52 × 4/52. The drawn card leaves the grid and the count under it reads 51.
- **Slots without dividing, or dividing when order matters.** 4 × 3 = 12 handshakes; offices divided by 4!. The collapse of orderings is shown only when the problem says order does not matter, and the lesson says which words say so ("president and vice president" against "a committee of three").
- **"Not (A and B)" read as "not A and not B".** The app's own decoys ({Student G, Student H} for (A ∩ B)′). On the Venn, outside the overlap includes everyone in just one circle.
- **Expected value as the plain average of the payoffs.** (20 + 17 + 1)/3. One play per section gives six plays, not three; the heavier sections appear more often in the leveling.
- **Forgetting the cost, or thinking a loss can't be expected.** The cost is a bar subtracted from every play; the net can be negative and the question says to write it so.
- **Area probability from lengths.** 2/11 for a circle of radius 2 in a square of side 11; or forgetting the complement for "outside". The rain lands in the shaded part in proportion to area, and "outside" flips to the rest.

### Lines worth remembering

Said once each, at the moment they apply, and put on the board or in the recap.

- "Count what you want. Count everything. Divide."
- "The equally likely things are the pieces, not the names."
- "Probability predicts the share, not the exact count."
- "More trials, closer."
- "An outcome is a pair. Pairs make a grid."
- "Or: shade both, count the overlap once."
- "Given means the whole shrinks to just those."
- "Independent: knowing one changes nothing about the other."
- "And in sequence: multiply along the path."
- "At least one is one minus none."
- "Slots multiply. Dividing by the orders forgets the order."
- "Expected value: imagine one play per piece, then take the mean."
- "Fair means every person owns the same share of the outcomes."

---

## 4. Tools to build

What exists and serves as is: `bar` (equal partitions, an interval shaded to scale, the double scale with share above and amount below, interior marks), `table` (cells, rows, columns, totals, `given`, highlights), `mosaic` (the four-region rectangle, slabs by group, colored shares, the dashed everyone-line), `grid`, `counters` and `count`, `circle`, `axes`, `curve`, `dot`, `label`, `poly`, `view`, the app's bar graph and histogram scenes, and `numberline` from the place-value spec (drop, arcs, zoom). This family needs the additions below, specified by what they take and what they do.

### 4.1 `strip`: the outcome strip (extends `bar`)

```json
{ "id": "s", "strip": "P", "w": 14, "h": 1.6, "cells": [
  {"counter": "warm"}, {"counter": "warm"}, {"counter": "warm"}, {"counter": "warm"},
  {"counter": "accent"}, "..." ], "scale": "chance", "counts": true }
```

- A `bar` whose n equal cells each hold a counter, a color fill or a TeX label (die faces, names). `scale: "chance"` draws the 0-to-1 line under the strip with ticks at every cell boundary and the word bands (impossible, unlikely, as likely as not, likely, certain); `counts: true` writes the live fraction beside the strip in the event's color over ink.
- `{"do":"pick","target":"s","cells":[1,2,3,4]}` or `"where":"odd"` shades a set of cells (not only an interval); `{"do":"sort","target":"s"}` slides the picked cells to the left end so the share reads on the chance line; `{"do":"drop","target":"s"}` drops the dot from the shaded edge onto the line; `{"do":"flip","target":"s"}` swaps shaded and unshaded; `{"do":"remove","target":"s.cell.7"}` takes a cell out to a tray and relabels the total.
- Parts: `s.cell.k`, `s.picked`, `s.rest`, `s.fraction`, `s.line`, `s.band.likely`, `s.dot`.

### 4.2 `bag` and `spinner`, with `lineup` and `unroll`

- `bag`: a bag outline holding counters (`counters` inside a `poly`), each counter a part; `{"do":"lineup","from":"bag","to":"s"}` slides counters one at a time into the strip's cells, like colors together, on the counting words.
- `spinner`: a circle cut into n equal sectors (on the P10 sector roadmap) with a color or a number in each and a pointer; `{"do":"spin","target":"sp","land":4}` turns the pointer to a section; `{"do":"unroll","target":"sp","to":"s"}` peels the sectors off in order and lays them as the strip's cells. Sector n of n is drawn at exactly 360/n degrees.
- A die face is a labeled cell; a deck is a `table` of 13 by 4 with rank headers and suit labels.

### 4.3 `table` as the outcome grid (extends `table`)

- `fill`: `{"do":"fill","target":"t.row.1","ink":"accent"}` colors cells in an event color (teal, rust); a cell filled twice turns violet; `{"do":"fill","where":"sum>=11"}` by a predicate on cell values.
- `count`: a live label of cells filled in a color, ticking as they fill; `{"do":"fill","target":"t.body","by":"rows"}` fills row by row with the count ticking by row (the counting principle).
- `remove` a cell to a tray (without replacement) with totals rewritten; `gather` (4.6) from a table.
- The grid's cells hold pairs ("T, 6"), sums or outcome numbers as TeX; `--dry` already reports a cell whose text does not fit.

### 4.4 `venn`: the sorting picture

```json
{ "id": "v", "venn": "C", "sets": ["\\text{Dog}", "\\text{Cat}"], "counts": [19, 7, 7, 16], "names": false }
```

- Two circles in a rectangle (the sample space), region counts or member names written inside; regions addressable as `v.onlyA`, `v.both`, `v.onlyB`, `v.neither`, `v.A` (both circles' union with A), `v.B`. `fill` and `highlight` as for cells; `given` dims everything outside a circle and rewrites the whole's label as that circle's total; `{"do":"totable","target":"v","to":"t"}` slides the four counts into a 2 × 2 `table`, and from there into a `mosaic`. Never to scale, and the authoring note says so.

### 4.5 `tree`: branches with fractions

```json
{ "id": "tr", "tree": "R", "stages": [
  { "branches": [ {"label":"\\text{rain}","p":"\\frac45"}, {"label":"\\text{no rain}","p":"\\frac15"} ] },
  { "branches": [ {"label":"\\text{late}","p":"\\frac15"}, {"label":"\\text{on time}","p":"\\frac45"} ],
    "under": 0 }, "..." ], "leaves": true }
```

- Stages of branches, each with a label and a TeX fraction; later stages can differ per parent (conditional second stage; `under` names the parent). `{"do":"walk","target":"tr","path":[1,0]}` lights the branches in turn and writes the product at the leaf. `"scale": true` sets the leaf spacing to the path probabilities so the tree can stand beside a `mosaic` whose slabs match it; the lesson shows that correspondence once, then uses whichever is clearer.

### 4.6 `dist`: the probability bar chart, with `gather`, `stack`, `level` and `balance`

- Bars over values with heights as probabilities and a fraction label on each; `{"do":"gather","from":"t","by":"value"}` slides a grid's cells into the columns of their values, bar by bar; `{"do":"stack","target":"d"}` lays the bars end to end into a unit strip and back; `{"do":"level","target":"d","plays":6}` draws one stack per equally likely piece (or per 1/d) and levels them to the mean (family 32's motion); `{"do":"balance","target":"d"}` draws a beam under the axis and slides a gold fulcrum to E(X), writing its value. A cost is a muted bar subtracted from every stack.
- For empirical distributions, the app's bar chart of frequencies converts to relative frequencies on the word ("divide every bar by 25").

### 4.7 `slots`: positions and the collapse of orders

- `{"id":"sl","slots":4,"at":"S"}` draws empty boxes with position names under them (president, vice president ...); `{"do":"drop","target":"sl.2","value":5}` writes a count into a box and extends the product under the row; `{"do":"collapse","target":"sl","k":3}` shows the k! orderings of one chosen group as cards that stack into one, and writes the division by k!.

### 4.8 `trials` and `runshare`: experiments that settle

- `{"id":"x","trials":{"p":[1,1,1,1,1,1],"n":90,"seed":7}}` is a deterministic sequence of outcomes; `{"do":"run","target":"x","to":90}` drops them one at a time into a frequency chart with a "k of n" label and speeds up after the first dozen; `runshare` is the plot of the running share against trials, traced as the run proceeds, with a dashed line at the true probability. Same seed, same film, every render.
- A prediction for n trials is the existing `bar` with `whole: n` shaded to the probability.

### 4.9 `rain` (area probability)

- `{"do":"rain","region":"board","inside":"circle","n":200,"seed":3}` drops seeded random dots on a region, counting those in the shaded part over all; small, and used for the one "why" beat in `area-probability`.

### 4.10 Board: `dim` for choices

The one-beat fade of ruled-out choices, already on the roadmap; this family's multiple-choice types all use it.

### Build order

1. `strip`, `bag`, `spinner` with `lineup` and `unroll`, the chance line: all eight grade-7 `probability` types.
2. `table` fills and counts, `venn` with `totable`: compound events, event sets, the addition rule, conditional probability (the `mosaic` and `given` exist).
3. `trials` and `runshare`: experimental probability and simulation comparisons.
4. `tree` with `walk` and `remove`: the multiplication rule and two draws with replacement.
5. `dist` with `gather`, `stack`, `level`, `balance`: expected value, random variables, distributions, decisions, fairness.
6. `slots` with `collapse`: permutations, combinations, combination probability.
7. `rain`: area probability.

---

## 5. The seam: who writes what

This division of work depends on a strong concept, a kit whose picture fits the problem, a strong review. The division below follows that.

**Strongest writer, because the quality is in the reasoning, not the picture:**
- `experimental-probability-predict`: the lesson is foundation 5 whole; it must say why few trials mislead and what "roughly, not exactly" means, and the multiple-choice decoys are beliefs, not arithmetic slips.
- `compound-event-simulation`: two kinds (a share of the grid; judging a simulation's result against theory) under one name; the second is interpretation.
- `staar-experiment-probability`: a mixed type (a table of results; two draws with replacement) that needs reading first.
- `conditional-everyday-reasoning`: entirely language: which group is the whole, P(A | B) against P(B | A), independence from two rates.
- `multiplication-rule-probability`: the insight that the second branch is a share of a new whole, with and without replacement, and the tree matched to the area once.
- `theoretical-distribution-expectation` and `random-variable-distribution`: the gather is the design, and the second type has four sub-asks.
- `fair-selection-procedure`, `strategy-expected-value`: a verdict with a justified reason; wrong-reason decoys.
- `independence-test`: use its screenplay as the reference for the table and mosaic.

**Capable cheaper writer from the per-type concept once the kit is complete, because each is one picture and one count, and `--dry` catches the slips:**
`simple-probability`, `probability-missing-count`, `likelihood-in-words`, `probability-on-number-line`, `equal-chance-choice`, `expected-count-blanks`, `counting-principle`, `event-set-count`, `event-complement-set` (the concept must name the De Morgan trap), `addition-rule-probability`, `addition-rule-steps`, `independent-events-probability`, `conditional-probability-value`, `area-probability`, `permutation-count`, `combination-count`, `empirical-distribution-expectation`, and `expected-value` after the pilot has set its picture. `combination-probability` sits on the line: the counting is mechanical but choosing to count "favorable groups the same way as all groups" is the idea; give it to the strong writer first and move it after a blind test.

Review stays at the top for every lesson in the first wave, as PROCESS.md says.

---

## 6. What looks misfiled, badly conceived or off grade; and clauses never practiced

> Base cases and trick questions (a spinner that is all one color, "certain") are wanted in the app. Flagging one here means only that it is a weak main worked example.

**Misfiled and mislinked.**
- `area-probability` sits under `conditional-probability` (geometry) with no condition in it, and its judged standards are 7.G.B.4 and 7.G.B.6: by the catalog it practices no probability standard. It is a uniform model with area as the count (7.SP.C.7a, with family 24's area). Move it to grade 7 `probability`.
- `counting-principle` is judged to serve 6.EE.A.1 ("evaluate numerical expressions involving whole-number exponents"). It has no exponent; it serves 7.SP.C.8b (represent sample spaces with tables). Fix the link.
- `staar-experiment-probability` holds two unrelated kinds: an experimental probability from a table of results (7.SP.C.6, 7b) and two draws with replacement (7.SP.C.8). Split them.
- `compound-event-simulation` never designs or runs a simulation; it computes a theoretical share and compares a reported count with it. Rename, or add the 8c kind (below).
- `independence-test` holds four kinds, one of which (P(A and B) from two independent percents) belongs with `independent-events-probability`.
- `mean` of a distribution is computed in four skills (`expected-value`, `theoretical-distribution-expectation`, `empirical-distribution-expectation`, `strategy-expected-value`). The ladder is fine (A2 meets it, PC builds distributions), but the "find E(X) of a given distribution" kind in `theoretical-distribution-expectation` duplicates `expected-value`.
- `probability-multiplication` is at precalculus while `conditional-probability` is at geometry; the general multiplication rule is the conditional probability formula rearranged and could ride with it. Defensible as is, since HSS.CP.B.8 is a (+) standard.
- `compound-event-simulation`'s decoys (7/8, 5/12) do not match the real error; the one children make is 1/2 + 1/6 = 2/3. Decoys should be the misconceptions.

**Standards clauses no problem practices** (exact text):
- 7.SP.C.7: "Compare probabilities from a model to observed frequencies; if the agreement is not good, explain possible sources of the discrepancy." The app compares; it never asks for a source.
- 7.SP.C.7b: "Do the outcomes for the spinning penny appear to be equally likely based on the observed frequencies?" Judging equal likelihood from data is never asked.
- 7.SP.C.8c: "Design and use a simulation to generate frequencies for compound events. For example, use random digits as a simulation tool to approximate the answer to the question: If 40% of donors have type A blood, what is the probability that it will take at least 4 donors to find one with type A blood?" Never: no random-digit simulation anywhere.
- HSS.CP.A.4: "Construct and interpret two-way frequency tables of data when two categories are associated with each object being classified." Tables are read, never constructed from a description.
- HSS.CP.B.6, B.7, B.8: "interpret the answer in terms of the model." The app asks for values only. The lessons supply the sentence anyway, since the sentence is where the understanding lives.
- HSS.MD.A.1: "graph the corresponding probability distribution using the same graphical displays as for data distributions." Read, never drawn.
- HSS.MD.A.3: "find the expected grade under various grading schemes." Expected value of a function of X is never asked.
- HSS.MD.B.7: "medical testing." No false-positive problem exists in the family; the CP.A.5 example, "compare the chance of having lung cancer if you are a smoker with the chance of being a smoker if you have lung cancer", is practiced only as rainy-day statements. The medical-test case is the one everyone remembers from this subject; it is a gap worth filling with one type (conditional probability from a tree or table with a rare condition).

---

## 7. The pilot: five problem types to build first

The pilot covers the whole arc in one sitting: the picture born and grown, every new tool exercised once, grade 7 through algebra 2, and the misconceptions standardized tests target.

| # | Problem type | Grade | Why it is in the pilot |
|---|---|---|---|
| 1 | `simple-probability` | 7 | The picture is born here: counters line up out of the bag into the strip, the event shades, the fraction writes as shaded over all, the dot drops onto the chance line. Kills "4/8" and "one of three colors". Exercises `strip`, `bag`, `lineup`, the chance line. If this is not beautiful, nothing after it will be. |
| 2 | `experimental-probability-predict` | 7 | Foundation 5 whole: the run that wobbles and settles, the prediction as a share of 90 rolls, observed against expected, and why 120 trials beat 12 with the same fraction. Exercises `trials`, `runshare`, the bar's double scale. The lesson most at risk of "jumping in without foundations", so the one to get right first. |
| 3 | `compound-event-simulation` | 7 | The grid: coin by die filled row by row, "tails or six" shaded twice and counted once (7 of 12, not 2/3), then a reported simulation count read against the theory. Exercises `table` fills and counts, and the mixed read. |
| 4 | `conditional-probability-value` | Geo | "Given" from both figures the app shows: the Venn with everything outside the dog circle dimmed and the whole rewritten as 26, and the table row (`given` exists). Exercises `venn`, `totable`, the shrink. |
| 5 | `expected-value` | A2 | The distribution from a spinner, one play per section leveled to the mean, the fulcrum finding 95/6, then a cost subtracted to a negative net. Exercises `dist`, `level`, `balance`; sets the picture every later expected-value type reuses. |

If the five land, the next wave completes the tool set: `multiplication-rule-probability` (the tree, with and without replacement), `theoretical-distribution-expectation` (the gather of 36 dice cells), `combination-count` and `permutation-count` (slots and the collapse), `event-complement-set` (the De Morgan trap on a Venn of names), and `area-probability` (the rain).
